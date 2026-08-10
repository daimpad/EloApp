import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // state.js und ui.js brauchen localStorage bzw. das DOM.
        environment: 'jsdom',
        include: ['src/**/*.test.js'],
    },
});
