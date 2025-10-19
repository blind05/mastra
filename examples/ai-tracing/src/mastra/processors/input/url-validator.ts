import type { InputProcessor } from '@mastra/core/processors';
import type { MastraMessageV2 } from '@mastra/core';

/**
 * URL Validator Input Processor
 * Non-model based processor that validates and sanitizes image URLs
 */
export const urlValidator: InputProcessor = {
  name: 'url-validator',
  processInput: async ({ messages }) => {
    // Extract URLs from the messages
    const urlPattern = /https?:\/\/[^\s]+/gi;

    for (const message of messages) {
      if (message.role === 'user') {
        for (const part of message.content.parts) {
          if (part.type === 'text') {
            const urls = part.text.match(urlPattern);

            if (urls) {
              for (const url of urls) {
                // Validate URL structure
                try {
                  const urlObj = new URL(url);

                  // Check if it's an image URL (basic check)
                  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
                  const hasImageExtension = imageExtensions.some(ext => urlObj.pathname.toLowerCase().endsWith(ext));

                  // Check Content-Type headers or common image hosting domains
                  const imageHosts = ['imgur.com', 'cloudinary.com', 'unsplash.com', 'pexels.com'];
                  const isImageHost = imageHosts.some(host => urlObj.hostname.includes(host));

                  if (!hasImageExtension && !isImageHost) {
                    // Add warning to the message
                    part.text += `\n[Warning: URL ${url} may not be an image URL]`;
                  }

                  // Log validation for tracing
                  console.log(`[URL Validator] Validated URL: ${url}, Is Image: ${hasImageExtension || isImageHost}`);
                } catch (error) {
                  // Invalid URL format
                  part.text = part.text.replace(url, `[Invalid URL: ${url}]`);
                  console.error(`[URL Validator] Invalid URL format: ${url}`);
                }
              }
            }
          }
        }
      }
    }

    return messages;
  },
};
