import jieba from 'nodejieba';
import path from 'path';
import { app } from 'electron';
import { once } from 'events';
import fs from 'fs';
import readline from 'readline';
import type {
  Book,
  SegmentedSentence,
} from '@/shared/types';
import { isInDictionary } from './dictionaries';
// direct from db to prevent cyclic dependency
import { dbGetBooks, dbBookSetCache } from './database';

const cache: {
  [path:string]: any
} = {};

async function computeDict() {
  // Load a copy of the jieba dict
  const prodDictFolder = path.join(process.resourcesPath, 'dict');
  const inputFile = import.meta.env.MODE === 'production'
    ? path.join(prodDictFolder, 'jieba.dict.utf8')
    : './node_modules/nodejieba/dict/jieba.dict.utf8';
  const outputFile = path.join(app.getPath('userData'), 'jieba.mod.dict.utf8');
  const inputStream = fs.createReadStream(inputFile);
  const outputStream = fs.createWriteStream(outputFile, { encoding: 'utf8' });
  const lineReader = readline.createInterface({
    input: inputStream,
    terminal: false,
  });
  let exists = 0;
  let lines = 0;
  lineReader.on('line', (line) => {
    const items = line.split(' ');
    const [word] = items;
    lines += 1;
    if (isInDictionary(word)) {
      outputStream.write(`${line}\n`);
      exists += 1;
    }
  });
  await once(lineReader, 'close');
  console.log(exists, lines);

  if (import.meta.env.MODE === 'production') {
    // The default dict doesn't load from the asar archive for some reason
    // If in production use the copies we have made in resources
    jieba.load({
      dict: outputFile,
      hmmDict: path.join(prodDictFolder, 'hmm_model.utf8'),
      userDict: path.join(prodDictFolder, 'user.dict.utf8'),
      idfDict: path.join(prodDictFolder, 'idf.utf8'),
      stopWordDict: path.join(prodDictFolder, 'stop_words.utf8'),
    });
  } else {
    jieba.load({
      dict: outputFile,
    });
  }
}
export async function loadSegmentedText(book:Book) {
  // If the book has already been reduced to sentences
  if (book.segmentedFile) {
    if (book.segmentedFile in cache) {
      return cache[book.segmentedFile];
    }

    const cacheLocation = path.join(
      app.getPath('userData'),
      'segmentationCache',
      book.segmentedFile,
    );
    const sentenceSeg = await fs.promises.readFile(cacheLocation, {
      encoding: 'utf-8',
      flag: 'r',
    });
    const parsed = JSON.parse(sentenceSeg);
    cache[book.segmentedFile] = parsed;
    return parsed;
  }

  // Otherwise we need to calculate the text
  const fullSegmentation = await loadJieba(book);
  console.log(typeof fullSegmentation);
  const joinedSentences = fullSegmentation.map(
    (sentence) => sentence.map(([word]) => word).join(''),
  );
  const fileName = `${book.title}-${book.author}.json`;
  const cacheLocation = path.join(
    app.getPath('userData'),
    'segmentationCache',
    fileName,
  );
  await fs.promises.writeFile(cacheLocation, JSON.stringify(joinedSentences));
  dbBookSetCache(book.bookId, fileName);
  return joinedSentences;
}

export function segmentSentence(sentence:string):SegmentedSentence {
  const json = jieba.cut(sentence);

  return json.map((word) => {
    // const punc = /\p{Script_Extensions=Han}/u;
    // const punc = /\p{CJK_Symbols_and_Punctuation}/u;
    const punc = /\p{P}/u;
    if (punc.test(word)) {
      // punctuation
      return [word, 1];
    }
    if (/\s+/.test(word)) {
      // whitespace
      return [word, 1];
    }
    if (/\p{Script=Latin}+/u.test(word)) {
      // english
      return [word, 1];
    }
    if (/\p{Script=Han}+/u.test(word)) {
      return [word, 3];
    }
    // console.log(`unknown ${word}`);
    return [word, 1];
  });
}

export async function loadJieba(book:Book) {
  const txtPath = book.filepath;
  // console.log(`Loading ${txtPath} for the first time`);
  const txt = await fs.promises.readFile(txtPath, {
    encoding: 'utf-8',
    flag: 'r',
  });
  // Misses names, but also makes less compound words
  // Haha, I see why they recommended the default. This still produces a
  // 'lower' accuracy than CTA, but it is not as bad as others
  // const json = rsjieba.cut(txt);
  //
  const json = jieba.cut(txt);

  // Detects names better but makes stuff like ?????????, ?????????
  // const json = nodejieba.cut(txt, true);

  // Creates weird words like ?????????, ?????????
  // const json = nodejieba.cutHMM(txt);

  // Creates words like ?????????
  // const json = nodejieba.cutAll(txt);

  // Doesn't get as many names still makes ?????????
  // const json = nodejieba.cutForSearch(txt);

  return json.reduce(
    (result, origword) => {
      let type:number;
      let word = origword;
      // const punc = /\p{Script_Extensions=Han}/u;
      // const punc = /\p{CJK_Symbols_and_Punctuation}/u;
      const punc = /\p{P}/u;
      if (punc.test(word)) {
      // punctuation
        type = 1;
      } else if (/\s+/.test(word)) {
      // whitespace
        type = 1;
      } else if (/\p{Script=Latin}+/u.test(word)) {
      // english
        type = 1;
      } else if (/\p{Script=Han}+/u.test(word)) {
        type = 3;
      } else {
        type = 1;
      }
      const end = result[result.length - 1];
      if (word.length > 1 && word.includes('.')) {
      // It sees 15. 14. etc as being words,
      // so remove the . since it breaks db storage
        word = word.replaceAll('.', '');
      }
      if (word === '\n') {
        if (end.length > 0) {
          result.push([]);
        }
      } else if (
        word === '???'
        || word === '???'
        || word === '???'
        || word === '???'
        || word === '.'
      ) {
        if (end.length === 0) {
          const previous = result[result.length - 2];
          previous.push([word, type]);
        } else {
          end.push([word, type]);
          result.push([]);
        }
      } else if (word === ' ' || word === '???' || word === '\t') {
      // cta strips leading spaces
        if (end.length > 0) {
          end.push([word, type]);
        }
      } else if (
        (word === '???' || word === '???' || word === '???')
        && end.length === 0
      ) {
      // Closing quotes go onto previous
        const previous = result[result.length - 2];
        previous.push([word, type]);
      } else {
        end.push([word, type]);
      }
      return result;
    },
    ([[]] as [string, number][][]),
  );
}

export async function preloadWords() {
  await computeDict();
  const books = await dbGetBooks();
  await Promise.all(books.map((bookInfo) => loadSegmentedText(bookInfo)));
}
/* const TYPE = {
  NONE: 0, // None - Indicative of an error
  INVALID: 1, // Invalid - Invalid utf8 text
  CHINESE: 2, // Chinese - A word made up of Chinese text
  ALPHA: 3, // Alpha - A word made up of letters from the English alphabet
  NUMBER: 4, // Number - A word made up of Arabic numerals
  WHITESPACE: 5, // Whitespace - A block of whitespace
                 // (spaces, tabs, newlines etc).
  CHINESEPUNCTUATION: 6, // ChinesePunctuation - Chinese punctuation
  ASCIIPUNCTUATION: 7, // AsciiPunctuation - Standard ascii
                       // (English) punctuation.
}; */
