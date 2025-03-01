export const env = createEnv({
  server: {
    ANTHROPIC_API_KEY: z.string().min(1),
  },
}); 