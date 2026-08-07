import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 백업 링크가 경로를 그대로 쓰기 때문에 어느 하위 경로에 올려도 동작하도록 상대 경로로 빌드한다.
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
