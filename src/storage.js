import fs from 'fs';

export const readData = (dataFile) => {
  try {
    return fs.readFileSync(dataFile, 'utf8');
  } catch (error) {
    console.error('Error reading data file:', error);
    return '{}';
  }
};

export const writeData = (dataFile, data) => {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${dataFile}`);
  } catch (error) {
    console.error('Error writing data file:', error);
    throw error;
  }
};
