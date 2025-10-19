import type { InputProcessor } from '@mastra/core/processors';
import type { MastraMessageV2 } from '@mastra/core';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Image Downloader Input Processor
 * Non-model based processor that downloads images to a temp location
 */
export const imageDownloader: InputProcessor = {
  name: 'image-downloader',
  processInput: async ({ messages }) => {
    const urlPattern = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp)/gi;
    const tempDir = path.join(process.cwd(), 'temp', 'images');

    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });

    for (const message of messages) {
      if (message.role === 'user') {
        for (const part of message.content.parts) {
          if (part.type === 'text') {
            const urls = part.text.match(urlPattern);

            if (urls) {
              for (const url of urls) {
                try {
                  // Generate unique filename
                  const timestamp = Date.now();
                  const extension = path.extname(new URL(url).pathname) || '.jpg';
                  const filename = `recipe_${timestamp}${extension}`;
                  const filepath = path.join(tempDir, filename);

                  // Download the image
                  console.log(`[Image Downloader] Downloading image from: ${url}`);
                  const response = await fetch(url);

                  if (!response.ok) {
                    throw new Error(`Failed to download: ${response.statusText}`);
                  }

                  // Save to file using streams for better memory efficiency
                  const buffer = await response.arrayBuffer();
                  await fs.writeFile(filepath, Buffer.from(buffer));

                  // Replace URL with local path in the message
                  part.text = part.text.replace(url, filepath);
                  console.log(`[Image Downloader] Image saved to: ${filepath}`);

                  // Add metadata about the download
                  part.text += `\n[Image downloaded to: ${filepath}]`;
                } catch (error) {
                  console.error(`[Image Downloader] Failed to download ${url}:`, error);
                  part.text += `\n[Failed to download image from: ${url}]`;
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
