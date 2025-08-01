import { ReadableStream } from 'stream/web';
import type { LanguageModelV1Prompt } from 'ai';
import { generateId } from 'ai';
import { z } from 'zod';
import { MessageList } from '../../../agent';
import { ConsoleLogger } from '../../../logger';
import type { ChunkType } from '../../../stream/types';
import { createStep, createWorkflow } from '../../../workflows';
import { executeV4 } from './ai-sdk/v4';
import { executeV5 } from './ai-sdk/v5/execute';
import { MastraModelOutput } from './base';
import { AgenticRunState } from './run-state';
import type { AgentWorkflowProps, StreamExecutorProps } from './types';

const toolCallInpuSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.any(),
});

const toolCallOutputSchema = toolCallInpuSchema.extend({
  result: z.any(),
});

const llmIterationOutputSchema = z.object({
  messageId: z.string(),
  messages: z.object({
    all: z.array(z.any()),
    user: z.array(z.any()),
    nonUser: z.array(z.any()),
  }),
  output: z.any(),
  metadata: z.any(),
  stepResult: z.any(),
});

function createAgentWorkflow({
  messageId,
  model,
  runId,
  providerMetadata,
  tools,
  toolChoice,
  activeTools,
  toolCallStreaming,
  _internal,
  experimental_generateMessageId,
  controller,
  options,
}: AgentWorkflowProps) {
  function toolCallStep() {
    return createStep({
      id: 'toolCallStep',
      inputSchema: toolCallInpuSchema,
      outputSchema: toolCallOutputSchema,
      execute: async ({ inputData, getStepResult }) => {
        const tool =
          tools?.[inputData.toolName] || Object.values(tools || {})?.find(tool => tool.name === inputData.toolName);

        if (!tool) {
          throw new Error(`Tool ${inputData.toolName} not found`);
        }

        if (!tool.execute) {
          return inputData;
        }

        const initialResult = getStepResult({
          id: 'generateText',
        } as any);

        const messageList = MessageList.fromArray(initialResult.messages.user);

        const result = await tool.execute(inputData.args, {
          toolCallId: inputData.toolCallId,
          messages: messageList.get.all
            ?.ui()
            ?.filter(message => message.role === 'user')
            ?.map(message => ({
              role: message.role,
              content: message.content,
            })) as any,
        });

        return { result, ...inputData };
      },
    });
  }

  function createLLMExecutionStep() {
    return createStep({
      id: 'generateText',
      inputSchema: z.object({
        messageId: z.string(),
        messages: z.object({
          all: z.array(z.any()),
          user: z.array(z.any()),
          nonUser: z.array(z.any()),
        }),
        metadata: z.any(),
        output: z.any(),
        stepResult: z.any(),
      }),
      outputSchema: llmIterationOutputSchema,
      execute: async ({ inputData }) => {
        const messagesToUse = inputData.messages.all;
        const messageList = MessageList.fromArray(messagesToUse);

        const runState = new AgenticRunState({
          _internal: _internal!,
          model,
        });

        let modelResult;

        let warnings: any;
        let request: any;
        let rawResponse: any;

        switch (model.specificationVersion) {
          case 'v1': {
            modelResult = executeV4({
              model,
              runId,
              providerMetadata,
              inputMessages: messageList.get.all.core() as any,
              tools,
              toolChoice,
              activeTools,
              _internal,
              options,
              onResult: ({
                warnings: warningsFromStream,
                request: requestFromStream,
                rawResponse: rawResponseFromStream,
              }) => {
                warnings = warningsFromStream;
                request = requestFromStream || {};
                rawResponse = rawResponseFromStream;

                controller.enqueue({
                  runId,
                  from: 'AGENT',
                  type: 'step-start',
                  payload: {
                    request: request || {},
                    warnings: [],
                    messageId: messageId,
                  },
                });
              },
            });
            break;
          }
          case 'v2': {
            modelResult = executeV5({
              model,
              runId,
              providerMetadata,
              inputMessages: messageList.get.all.core() as any,
              tools,
              toolChoice,
              activeTools,
              _internal,
              options,
              onResult: ({
                warnings: warningsFromStream,
                request: requestFromStream,
                rawResponse: rawResponseFromStream,
              }) => {
                warnings = warningsFromStream;
                request = requestFromStream || {};
                rawResponse = rawResponseFromStream;

                console.log('RAW', rawResponse);

                controller.enqueue({
                  runId,
                  from: 'AGENT',
                  type: 'step-start',
                  payload: {
                    request: request || {},
                    warnings: [],
                    messageId: messageId,
                  },
                });
              },
            });

            break;
          }
          default: {
            //@ts-ignore
            throw new Error(`Unsupported model version: ${model.specificationVersion}`);
          }
        }

        const outputStream = new MastraModelOutput({
          version: model.specificationVersion,
          stream: modelResult!,
          options: {
            toolCallStreaming,
          },
        });

        try {
          for await (const chunk of outputStream.fullStream) {
            if (['text-delta', 'reasoning-delta', 'source', 'tool-call', 'tool-call-delta'].includes(chunk.type)) {
              await options?.onChunk?.(chunk);
            }

            if (
              chunk.type !== 'reasoning-delta' &&
              chunk.type !== 'reasoning-signature' &&
              chunk.type !== 'redacted-reasoning' &&
              runState.state.isReasoning
            ) {
              if (runState.state.reasoningDeltas.length) {
                messageList.add(
                  {
                    id: messageId,
                    role: 'assistant',
                    content: [
                      {
                        type: 'reasoning',
                        text: runState.state.reasoningDeltas.join(''),
                        signature: chunk.payload.signature,
                        providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
                      },
                    ],
                  },
                  'response',
                );
              }

              runState.setState({
                isReasoning: false,
                reasoningDeltas: [],
              });
            }

            if (chunk.type !== 'text-delta' && chunk.type !== 'tool-call' && runState.state.isStreaming) {
              if (runState.state.textDeltas.length) {
                messageList.add(
                  {
                    id: messageId,
                    role: 'assistant',
                    content: [
                      {
                        type: 'text',
                        text: runState.state.textDeltas.join(''),
                        providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
                      },
                    ],
                  },
                  'response',
                );
              }

              runState.setState({
                isStreaming: false,
                textDeltas: [],
              });
            }

            switch (chunk.type) {
              case 'error':
                runState.setState({
                  hasErrored: true,
                });

                controller.enqueue(chunk);

                runState.setState({
                  stepResult: {
                    isContinued: false,
                    reason: 'error',
                  },
                });

                await options?.onError?.({ error: chunk.payload.error });

                break;
              case 'response-metadata':
                runState.setState({
                  responseMetadata: {
                    id: chunk.payload.id,
                    timestamp: chunk.payload.timestamp,
                    modelId: chunk.payload.modelId,
                    headers: chunk.payload.headers,
                  },
                });
                break;
              case 'finish':
                providerMetadata = chunk.payload.metadata.providerMetadata;
                runState.setState({
                  stepResult: {
                    reason: chunk.payload.reason,
                    logprobs: chunk.payload.logprobs,
                    warnings: warnings,
                    totalUsage: chunk.payload.totalUsage,
                    headers: rawResponse?.headers,
                    messageId,
                    isContinued: !['stop', 'error'].includes(chunk.payload.reason),
                    request,
                  },
                });
                break;
              case 'reasoning-delta': {
                const reasoningDeltasFromState = runState.state.reasoningDeltas;
                reasoningDeltasFromState.push(chunk.payload.text);
                runState.setState({
                  isReasoning: true,
                  reasoningDeltas: reasoningDeltasFromState,
                  providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
                });
                controller.enqueue(chunk);
                break;
              }
              case 'reasoning-signature': {
                const reasoningDeltasFromState = runState.state.reasoningDeltas;
                if (reasoningDeltasFromState.length) {
                  messageList.add(
                    {
                      id: messageId,
                      role: 'assistant',
                      content: [
                        {
                          type: 'reasoning',
                          text: reasoningDeltasFromState.join(''),
                          signature: chunk.payload.signature,
                          providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
                        },
                      ],
                    },
                    'response',
                  );

                  runState.setState({
                    reasoningDeltas: [],
                    providerOptions: undefined,
                  });
                }

                controller.enqueue(chunk);
                break;
              }
              case 'reasoning-start': {
                runState.setState({
                  providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
                });

                if (Object.values(chunk.payload.providerMetadata || {}).find((v: any) => v?.redactedData)) {
                  messageList.add(
                    {
                      id: messageId,
                      role: 'assistant',
                      content: [
                        {
                          type: 'reasoning',
                          text: '',
                          providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
                        },
                      ],
                    },
                    'response',
                  );
                  controller.enqueue(chunk);
                  break;
                }
                controller.enqueue(chunk);
                break;
              }
              case 'redacted-reasoning':
                messageList.add(
                  {
                    id: messageId,
                    role: 'assistant',
                    content: [{ type: 'redacted-reasoning', data: chunk.payload.data }],
                  },
                  'response',
                );
                controller.enqueue(chunk);
                break;
              case 'tool-call-delta':
                const hasToolCallStreaming = runState.state.hasToolCallStreaming;
                if (!hasToolCallStreaming && model.specificationVersion === 'v1') {
                  // @TODO:
                  // This needs to go to src/llm/model/stream/ai-sdk/v4/input.ts as an input stream transform, to add events
                  controller.enqueue({
                    type: 'tool-call-input-streaming-start',
                    from: 'AGENT',
                    runId: chunk.runId,
                    payload: {
                      toolCallId: chunk.payload.toolCallId,
                      toolName: chunk.payload.toolName,
                    },
                  });

                  await options?.onChunk?.({
                    type: 'tool-call-input-streaming-start',
                    from: 'AGENT',
                    runId: chunk.runId,
                    payload: {
                      toolCallId: chunk.payload.toolCallId,
                      toolName: chunk.payload.toolName,
                    },
                  });

                  runState.setState({
                    hasToolCallStreaming: true,
                  });
                }
                controller.enqueue(chunk);
                break;
              case 'file':
                messageList.add(
                  {
                    id: messageId,
                    role: 'assistant',
                    content: [
                      {
                        type: 'file',
                        data: chunk.payload.data,
                        mimeType: chunk.payload.mimeType,
                      },
                    ],
                  },
                  'response',
                );
                controller.enqueue(chunk);
                break;
              case 'source':
                console.log('source start', chunk.payload);
                messageList.add(
                  {
                    id: messageId,
                    role: 'assistant',
                    content: {
                      format: 2,
                      parts: [
                        {
                          type: 'source',
                          source: {
                            sourceType: 'url',
                            id: chunk.payload.id,
                            url: chunk.payload.url,
                            title: chunk.payload.title,
                            providerMetadata: chunk.payload.providerMetadata,
                          },
                        },
                      ],
                    },
                    createdAt: new Date(),
                  },
                  'response',
                );

                console.log('messageList after', JSON.stringify(messageList.get.all.v1(), null, 2));
                controller.enqueue(chunk);
                break;
              case 'text-delta': {
                const textDeltasFromState = runState.state.textDeltas;
                textDeltasFromState.push(chunk.payload.text);
                runState.setState({
                  textDeltas: textDeltasFromState,
                  isStreaming: true,
                });
                controller.enqueue(chunk);
                break;
              }
              default:
                controller.enqueue(chunk);
            }

            if (['text-delta', 'reasoning', 'source', 'tool-call', 'tool-call-delta'].includes(chunk.type)) {
              await options?.onChunk?.(chunk);
            }

            if (runState.state.hasErrored) {
              break;
            }
          }
        } catch (error) {
          console.log('Error in LLM Execution Step', error);

          runState.setState({
            hasErrored: true,
            stepResult: {
              isContinued: false,
              reason: 'error',
            },
          });
        }

        const toolCalls = outputStream.toolCalls?.map(chunk => {
          return chunk.payload;
        });

        /**
         * Update Message List piece
         */

        if (toolCalls.length > 0) {
          const assistantContent = [
            ...(toolCalls.map(toolCall => {
              return {
                type: 'tool-call',
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                args: toolCall.args,
              };
            }) as any),
          ];

          messageList.add(
            {
              id: messageId,
              role: 'assistant',
              content: assistantContent,
            },
            'response',
          );
        }

        /**
         * Assemble messages
         */

        const allMessages = messageList.get.all.v1().map(message => {
          return {
            id: message.id,
            role: message.role,
            content: message.content,
          };
        });

        console.log('allMessages', JSON.stringify(allMessages, null, 2));

        const userMessages = allMessages.filter(message => message.role === 'user');
        const nonUserMessages = allMessages.filter(message => message.role !== 'user');

        const finishReason = runState?.state?.stepResult?.reason ?? outputStream.finishReason;
        const hasErrored = runState.state.hasErrored;
        const usage = outputStream.usage;
        const responseMetadata = runState.state.responseMetadata;
        const text = outputStream.text;

        return {
          messageId,
          stepResult: {
            reason: hasErrored ? 'error' : finishReason,
            warnings,
            isContinued: !['stop', 'error'].includes(finishReason),
          },
          metadata: {
            providerMetadata: providerMetadata,
            ...responseMetadata,
            headers: rawResponse?.headers,
            request,
          },
          output: {
            text,
            toolCalls,
            usage: usage ?? inputData.output?.usage,
            steps: outputStream.steps,
          },
          messages: {
            all: allMessages,
            user: userMessages,
            nonUser: nonUserMessages,
          },
        };
      },
    });
  }

  function llmMappingStep() {
    return createStep({
      id: 'llmExecutionMappingStep',
      inputSchema: z.array(toolCallOutputSchema),
      outputSchema: llmIterationOutputSchema,
      execute: async ({ inputData, getStepResult, bail }) => {
        const initialResult = getStepResult(llmExecutionStep);

        const messageList = MessageList.fromArray(initialResult.messages.all || []);

        if (inputData?.every(toolCall => toolCall?.result === undefined)) {
          initialResult.stepResult.isContinued = false;
          return bail(initialResult);
        }

        if (inputData?.length) {
          for (const toolCall of inputData) {
            const chunk = {
              type: 'tool-result',
              runId: runId,
              from: 'AGENT',
              payload: {
                args: toolCall.args,
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                result: toolCall.result,
              },
            };

            controller.enqueue(chunk);

            await options?.onChunk?.(chunk);
          }

          const toolResultMessageId = experimental_generateMessageId?.() || _internal?.generateId?.();

          messageList.add(
            {
              id: toolResultMessageId,
              role: 'tool',
              content: inputData.map(toolCall => {
                return {
                  type: 'tool-result',
                  args: toolCall.args,
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  result: toolCall.result,
                };
              }),
            },
            'response',
          );
        }

        return {
          ...initialResult,
          messages: {
            all: messageList.get.all.v1().map(message => {
              return {
                id: message.id,
                role: message.role,
                content: message.content,
              };
            }),
            user: messageList.get.all
              .v1()
              .filter(message => message.role === 'user')
              .map(message => {
                return {
                  id: message.id,
                  role: message.role,
                  content: message.content,
                };
              }),
            nonUser: messageList.get.all
              .v1()
              .filter(message => message.role !== 'user')
              .map(message => {
                return {
                  id: message.id,
                  role: message.role,
                  content: message.content,
                };
              }),
          },
        };
      },
    });
  }

  const llmExecutionStep = createLLMExecutionStep();
  const toolCallExecutionStep = toolCallStep();
  const llmExecutionMappingStep = llmMappingStep();

  return createWorkflow({
    id: 'executionWorkflow',
    inputSchema: llmIterationOutputSchema,
    outputSchema: z.any(),
  })
    .then(llmExecutionStep)
    .map(({ inputData }) => {
      return inputData.output.toolCalls || [];
    })
    .foreach(toolCallExecutionStep)
    .then(llmExecutionMappingStep)
    .commit();
}

function createStreamExecutor({
  _internal,
  experimental_generateMessageId,
  model,
  runId,
  providerMetadata,
  tools,
  toolChoice,
  activeTools,
  inputMessages,
  options,
  maxRetries = 2,
  maxSteps = 5,
  logger,
}: StreamExecutorProps) {
  return new ReadableStream<ChunkType>({
    start: async controller => {
      const messageId = experimental_generateMessageId?.() || _internal?.generateId?.();

      let stepCount = 0;

      const outerAgentWorkflow = createAgentWorkflow({
        messageId: messageId!,
        model,
        runId,
        providerMetadata,
        tools,
        toolChoice,
        activeTools,
        inputMessages,
        _internal,
        experimental_generateMessageId,
        controller,
        options,
        logger,
      });

      const mainWorkflow = createWorkflow({
        id: 'agentic-loop',
        inputSchema: llmIterationOutputSchema,
        outputSchema: z.any(),
        retryConfig: {
          attempts: maxRetries,
        },
      })
        .dowhile(outerAgentWorkflow, async ({ inputData }) => {
          const hasFinishedSteps = stepCount > maxSteps;

          inputData.stepResult.isContinued = hasFinishedSteps ? false : inputData.stepResult.isContinued;

          controller.enqueue({
            type: 'step-finish',
            runId,
            from: 'AGENT',
            payload: inputData,
          });

          const reason = inputData.stepResult.reason;

          if (reason === undefined) {
            return false;
          }

          return inputData.stepResult.isContinued && stepCount < maxSteps;
        })
        .map(({ inputData }) => {
          const toolCalls = inputData.messages.nonUser.filter((message: any) => message.role === 'tool');

          inputData.output.toolCalls = toolCalls;

          return inputData;
        })

        .commit();

      controller.enqueue({
        type: 'start',
        runId,
        from: 'AGENT',
        payload: {},
      });

      const run = await mainWorkflow.createRunAsync({
        runId,
      });

      const executionResult = await run.start({
        inputData: {
          messages: {
            all: inputMessages,
            user: inputMessages,
            nonUser: [],
          },
        },
      });

      if (executionResult.status !== 'success') {
        controller.close();
        return;
      }

      controller.enqueue({
        type: 'finish',
        runId,
        from: 'AGENT',
        payload: executionResult.result,
      });

      controller.close();
    },
  });
}

export async function execute(
  props: { system?: string; prompt?: string } & { resourceId?: string; threadId?: string } & Omit<
      StreamExecutorProps,
      'inputMessages'
    >,
) {
  const { system, prompt, resourceId, threadId, runId, _internal, logger, ...rest } = props;

  let loggerToUse =
    logger ||
    new ConsoleLogger({
      level: 'debug',
    });

  let runIdToUse = runId;

  if (!runIdToUse) {
    runIdToUse = crypto.randomUUID();
  }

  const messageList = new MessageList({
    threadId,
    resourceId,
  });

  if (system) {
    messageList.addSystem(system);
  }

  if (prompt) {
    messageList.add(prompt, 'user');
  }

  const messages = messageList.get.all.core() as LanguageModelV1Prompt;

  let _internalToUse = _internal || {
    currentDate: () => new Date(),
    now: () => Date.now(),
    generateId,
  };

  // We call this for no reason because of aisdk
  if (rest.model.specificationVersion === 'v1') {
    _internalToUse.generateId?.();
  }

  const streamExecutorProps: StreamExecutorProps = {
    runId,
    _internal: _internalToUse,
    inputMessages: messages,
    logger: loggerToUse,
    ...rest,
  };

  const executor = createStreamExecutor(streamExecutorProps);

  return new MastraModelOutput({
    version: rest.model.specificationVersion,
    stream: executor,
    options: {
      toolCallStreaming: rest.toolCallStreaming,
      onFinish: rest.options?.onFinish,
    },
  });
}
