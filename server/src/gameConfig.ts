import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameConfig2026 } from 'requests';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const configFile = path.resolve(
    currentDir,
    '../../client/src/assets/game_config_2026.json'
);

if (!fs.existsSync(configFile)) {
    throw new Error(`Missing game config at ${configFile}`);
}

const gameConfig = JSON.parse(
    fs.readFileSync(configFile, { encoding: 'utf8' })
) as GameConfig2026;

export { gameConfig, configFile };
