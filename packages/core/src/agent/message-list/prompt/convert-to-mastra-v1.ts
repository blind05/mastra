/**
 * This file is an adaptation of https://github.com/vercel/ai/blob/e14c066bf4d02c5ee2180c56a01fa0e5216bc582/packages/ai/core/prompt/convert-to-core-messages.ts
 * But has been modified to work with Mastra storage adapter messages (MastraMessageV1)
 */
import type { MastraMessageV1 } from '../../../memory/types';
import type { MastraMessageContentV2, MastraMessageV2 } from '../../message-list';
import type { ToolResultPart } from '../ai-sdk-4/core/prompt/content-part';
import type { AssistantContent, UserContent } from '../ai-sdk-4/core/prompt/message';
import { attachmentsToParts } from './attachments-to-parts';

const makePushOrCombine = (v1Messages: MastraMessageV1[]) => (msg: MastraMessageV1) => {
  msg = { ...msg };
  if (Array.isArray(msg.content) && msg.content.length === 1 && msg.content[0]?.type === `text`) {
    msg.content = msg.content[0].text;
  }
  const previousMessage = v1Messages.at(-1);
  if (
    msg.role === previousMessage?.role &&
    Array.isArray(previousMessage.content) &&
    Array.isArray(msg.content) &&
    // we were creating new messages for tool calls before and not appending to the assistant message
    // so don't append here so everything works as before
    (msg.role !== `assistant` || (msg.role === `assistant` && msg.content.at(-1)?.type !== `tool-call`))
  ) {
    for (const part of msg.content) {
      previousMessage.content.push(part);
    }
  } else {
    v1Messages.push(msg);
  }
};
export function convertToV1Messages(messages: Array<MastraMessageV2>) {
  const v1Messages: MastraMessageV1[] = [];
  const pushOrCombine = makePushOrCombine(v1Messages);

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const isLastMessage = i === messages.length - 1;
    if (!message?.content) continue;
    const { content, experimental_attachments: inputAttachments = [], parts: inputParts } = message.content;
    const { role } = message;
    const fields = {
      id: message.id,
      createdAt: message.createdAt,
      resourceId: message.resourceId!,
      threadId: message.threadId!,
    };

    const experimental_attachments = [...inputAttachments];
    const parts: typeof inputParts = [];
    for (const part of inputParts) {
      if (part.type === 'file') {
        experimental_attachments.push({
          url: part.data,
          contentType: part.mimeType,
        });
      } else {
        parts.push(part);
      }
    }

    switch (role) {
      case 'user': {
        if (parts == null) {
          const userContent: UserContent = experimental_attachments
            ? ([
                { type: 'text' as const, text: content || '' },
                ...attachmentsToParts(experimental_attachments),
              ] as UserContent)
            : content || '';
          pushOrCombine({
            role: 'user',
            ...fields,
            type: 'text',
            content: userContent,
          });
        } else {
          const textParts = message.content.parts
            .filter(part => part.type === 'text')
            .map(part => ({
              type: 'text' as const,
              text: part.text,
            }));

          const userContent: UserContent = experimental_attachments
            ? [...textParts, ...attachmentsToParts(experimental_attachments)]
            : textParts;
          pushOrCombine({
            role: 'user',
            ...fields,
            type: 'text',
            content:
              Array.isArray(userContent) &&
              userContent.length === 1 &&
              userContent[0]?.type === `text` &&
              typeof content !== `undefined`
                ? content
                : userContent,
          });
        }
        break;
      }

      case 'assistant': {
        if (message.content.parts != null) {
          let currentStep = 0;
          let blockHasToolInvocations = false;
          let block: MastraMessageContentV2['parts'] = [];

          function processBlock() {
            const content: AssistantContent = [];

            for (const part of block) {
              switch (part.type) {
                case 'text': {
                  content.push({
                    type: 'text' as const,
                    text: part.text,
                  });
                  break;
                }
                case 'file': {
                  content.push({
                    type: 'file' as const,
                    data: part.data,
                    mimeType: part.mimeType,
                  });
                  break;
                }
                case 'reasoning': {
                  for (const detail of part.details) {
                    switch (detail.type) {
                      case 'text':
                        content.push({
                          type: 'reasoning' as const,
                          text: detail.text,
                        });
                        break;
                      case 'redacted':
                        content.push({
                          type: 'reasoning' as const,
                          text: '[redacted]',
                        });
                        break;
                    }
                  }
                  break;
                }
                case 'tool-invocation':
                  content.push({
                    type: 'tool-call' as const,
                    toolCallId: part.toolInvocation.toolCallId,
                    toolName: part.toolInvocation.toolName,
                    args: part.toolInvocation.args,
                  });
                  break;
              }
            }

            pushOrCombine({
              role: 'assistant',
              ...fields,
              type: content.some(c => c.type === `tool-call`) ? 'tool-call' : 'text',
              // content: content,
              content:
                typeof content !== `string` &&
                Array.isArray(content) &&
                content.length === 1 &&
                content[0]?.type === `text`
                  ? message?.content?.content || content
                  : content,
            });

            // check if there are tool invocations with results in the block
            const stepInvocations = block
              .filter(part => `type` in part && part.type === 'tool-invocation')
              .map(part => part.toolInvocation)
              .filter(inv => inv.state === 'result') as Array<{
              state: 'result';
              step?: number;
              toolCallId: string;
              toolName: string;
              result: unknown;
            }>;

            // tool message with tool results
            if (stepInvocations.length > 0) {
              pushOrCombine({
                role: 'tool',
                ...fields,
                type: 'tool-result',
                content: stepInvocations.map((toolInvocation): ToolResultPart => {
                  const { toolCallId, toolName } = toolInvocation;
                  return {
                    type: 'tool-result',
                    toolCallId,
                    toolName,
                    result: toolInvocation.result || '',
                  };
                }),
              });
            }

            // updates for next block
            block = [];
            blockHasToolInvocations = false;
            currentStep++;
          }

          for (const part of message.content.parts) {
            switch (part.type) {
              case 'text': {
                if (blockHasToolInvocations) {
                  processBlock(); // text must come before tool invocations
                }
                block.push(part);
                break;
              }
              case 'file':
              case 'reasoning': {
                block.push(part);
                break;
              }
              case 'tool-invocation': {
                if ((part.toolInvocation.step ?? 0) !== currentStep) {
                  processBlock();
                }
                block.push(part);
                blockHasToolInvocations = true;
                break;
              }
            }
          }

          processBlock();

          break;
        }

        const toolInvocations = message.content.toolInvocations;

        if (toolInvocations == null || toolInvocations.length === 0) {
          pushOrCombine({ role: 'assistant', ...fields, content: content || '', type: 'text' });
          break;
        }

        const maxStep = toolInvocations.reduce((max, toolInvocation) => {
          return Math.max(max, toolInvocation.step ?? 0);
        }, 0);

        for (let i = 0; i <= maxStep; i++) {
          const stepInvocations = toolInvocations.filter(toolInvocation => (toolInvocation.step ?? 0) === i);

          if (stepInvocations.length === 0) {
            continue;
          }

          // assistant message with tool calls
          pushOrCombine({
            role: 'assistant',
            ...fields,
            type: 'tool-call',
            content: [
              ...(isLastMessage && content && i === 0 ? [{ type: 'text' as const, text: content }] : []),
              ...stepInvocations.map(({ toolCallId, toolName, args }) => ({
                type: 'tool-call' as const,
                toolCallId,
                toolName,
                args,
              })),
            ],
          });

          // tool message with tool results
          pushOrCombine({
            role: 'tool',
            ...fields,
            type: 'tool-result',
            content: stepInvocations.map((toolInvocation): ToolResultPart => {
              if (toolInvocation.state === 'result') {
                const { toolCallId, toolName, result } = toolInvocation;
                return {
                  type: 'tool-result',
                  toolCallId,
                  toolName,
                  result,
                };
              } else {
                return {
                  type: 'tool-result',
                  toolCallId: toolInvocation.toolCallId,
                  toolName: toolInvocation.toolName,
                  result: '',
                };
              }
            }),
          });
        }

        if (content && !isLastMessage) {
          pushOrCombine({ role: 'assistant', ...fields, type: 'text', content: content || '' });
        }

        break;
      }
    }
  }

  return v1Messages;
}
