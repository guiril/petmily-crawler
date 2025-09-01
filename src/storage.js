import fs from 'fs';
import { DATA_FILE } from '../config.js';

export const readData = () => {
  try {
    return fs.readFileSync(DATA_FILE, 'utf8');
  } catch (error) {
    console.error('Error reading data file:', error);
    return '{}';
  }
};

export const writeData = (data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${DATA_FILE}`);
  } catch (error) {
    console.error('Error writing data file:', error);
    throw error;
  }
};
