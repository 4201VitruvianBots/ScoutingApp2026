import mongoose from 'mongoose';
import ngrok from 'ngrok';
import dotenv from 'dotenv-mono';
import chalk from 'chalk';
import { startDockerContainer, stopDockerContainer } from 'database';
import { app } from './server.js';

// If DEV is true then change the port we are running on, to prevent undesired caching
const BACKEND_PORT = process.env.NODE_ENV === 'dev' ? 8081 : 8080;

dotenv.load({ path: '.env' });
dotenv.load({ path: '.env.local' });

const REMOTE = process.env.LOCATION === 'remote';
const isDev = process.env.NODE_ENV === 'dev';
const devUseDocker = ['1', 'true', 'yes', 'on'].includes(
    String(process.env.DEV_USE_DOCKER ?? '').toLowerCase()
);
const dbEnabled = !isDev || devUseDocker;
process.env.DB_ENABLED = dbEnabled ? 'true' : 'false';

let container: Awaited<ReturnType<typeof startDockerContainer>> | null = null;

if (dbEnabled) {
    process.env.CONTAINER_NAME ??= 'cala-quals';
    container = await startDockerContainer(process.env.CONTAINER_NAME);
    await mongoose.connect('mongodb://0.0.0.0:27017/');
} else {
    console.log(
        chalk.yellow(
            'Dev mode running without Docker/Mongo (set DEV_USE_DOCKER=1 to enable DB).'
        )
    );
}

const server = app.listen(BACKEND_PORT, () => {
    console.log(chalk.green('Server running at http://localhost:' + BACKEND_PORT));
});

if (REMOTE) {
    const url = await ngrok.connect({
        authtoken: process.env.NGROK_TOKEN,
        addr: 8080,
    });
    console.log(chalk.green(`Server is accessible at ${url}`));
}

let stopping = false;

const handleExit = async () => {
    if (stopping) return;
    stopping = true;

    console.log(chalk.blue('\nStopping server...'));

    server.close();

    if (dbEnabled) {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        if (container) {
            await stopDockerContainer(container);
        }
    }

    console.log(chalk.green('Done'));

    process.exit();
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
