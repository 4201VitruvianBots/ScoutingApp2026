import fs from 'fs';
import { GameConfig2026 } from 'requests';

const configFile = '../client/src/assets/game_config_2026.json';

if (!fs.existsSync(configFile)) {
    throw new Error(`Missing game config at ${configFile}`);
}

const gameConfig = JSON.parse(
    fs.readFileSync(configFile, { encoding: 'utf8' })
) as GameConfig2026;

export { gameConfig, configFile };
