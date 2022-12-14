// load dictionary
import fs from 'fs';
import type {
  DictionaryType, DictionaryEntry, UnknownWordEntry,
} from '@/shared/types';
import { isKnown } from './knownWords';
import {
  dbSaveDict, dbLoadDicts, dbGetPrimaryDict, dbSetPrimaryDict, dbDeleteDict,
} from './database';

const dicts: { [key:string]:any } = {
};
// TODO have these user set
let defaultDict = 'ccdict';

export function addDictionary(name:string, path:string, type:DictionaryType) {
  // Just for now
  // Later we will make our own copy of the dictionary
  dbSaveDict(name, path, type);
  // After adding a new dict load it
  loadDictionaries();
}

export function deleteDictionary(name:string) {
  dbDeleteDict(name);
  delete dicts[name];
}

function setPrimaryDict(dictName:string) {
  console.log('setting primary dict to ', dictName);
  defaultDict = dictName;
  dbSetPrimaryDict(dictName);
}

export function dictionaryInfo() {
  return dbLoadDicts();
}

export function loadDictionaries() {
  const ldicts = dbLoadDicts();
  defaultDict = dbGetPrimaryDict();
  Object.entries(ldicts).forEach(([name, entry]) => {
    console.log(name, entry);
    const fileContents = fs.readFileSync(entry.path);
    const contents = JSON.parse(fileContents.toString());
    const dictionary: { [key:string]:any } = {};
    contents.forEach((term:any) => {
      const word = term.term;
      if (!(word in dictionary)) {
        dictionary[word] = [];
      }
      dictionary[word].push(term);
    });
    console.log(name, Object.keys(dictionary).length);
    dicts[name] = {
      dictionary,
      type: entry.type,
    };
  });
}

// This is just used for a simple definition when displaying
// in large word lists
export function getDefaultDefinition(word:string) {
  const term = dicts[defaultDict].dictionary[word];
  if (term === undefined) {
    return undefined;
  }
  return term[0].definition;
}

export function getPinyin(word:string) {
  const terms = dicts[defaultDict].dictionary[word];
  if (!terms) {
    // TODO do char by char lookup and concatinate?
    return '';
  }
  return [...new Set(terms.map((term:any) => term.pronunciation))].join(', ');
}

function getPossibleWords(partialWord:string) {
  const words = new Set(
    Object.keys(dicts[defaultDict].dictionary)
      .filter((word) => word.indexOf(partialWord) !== -1)
      .filter((word) => !isKnown(word)),
  );
  return getDefinitions(
    [...words].map((word) => ({
      word,
    })),
  );
}

function getDefinitions(words:UnknownWordEntry[]) {
  return words.map((word) => ({
    ...word,
    definition: getDefaultDefinition(word.word),
    pinyin: getPinyin(word.word),
  }));
}

export function isInDictionary(word:string) {
  return Object.values(dicts).some((dict) => word in dict.dictionary);
}

// type = 'english' or 'chinese'
function getDefinitionsForWord(word:string, type:DictionaryType) {
  const answers:DictionaryEntry[] = [];

  Object.values(dicts)
    .filter((dict) => dict.type === type)
    .forEach((dict) => {
      const term = dict.dictionary[word];
      if (term === undefined) {
        return;
      }
      term.forEach((def:any) => {
        answers.push({
          definition: def.definition.replace(/\n/g, '<br>'),
          // No spaces in pinyin
          pronunciation: def.pronunciation.replace(/ /g, ''),
        });
      });
    });

  return answers;
}

export const dictionariesIpc = {
  getDefinitionsForWord,
  dictionaryInfo,
  addDictionary,
  setPrimaryDict,
  deleteDictionary,
  getDefinitions,
  getPossibleWords,
};
