import { createServer } from './server';

createServer().listen(3000, () => {
    // biome-ignore lint/suspicious/noConsole: log server start
    console.log('Server is listening...');
});
