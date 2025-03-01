import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../../../env.mjs';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

export async function generateWithClaude(prompt: string) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    return {
      success: true,
      content: message.content[0].text,
    };
  } catch (error) {
    console.error('Error generating with Claude:', error);
    return {
      success: false,
      error: 'Failed to generate response',
    };
  }
} 