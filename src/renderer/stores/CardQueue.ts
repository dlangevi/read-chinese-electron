import { defineStore } from 'pinia';

export enum ActionsEnum {
  CREATE = 'create',
  MODIFY = 'modify',
}

export type WordOptions = {
  preferBook?:number
  callback?: () => void
};

type WordlistEntry = {
  word:string
  action:ActionsEnum
  preferBook?:number
  callback?: () => void
};

export const useCardQueue = defineStore('CardQueue', {
  state: () => ({
    wordList: [],
  } as { wordList: WordlistEntry[] }),
  getters: {
    words: (state) => state.wordList,
  },
  actions: {
    // Callback runs on word submition
    // TODO? also have a callback for word failure?
    async addWord(
      word:string,
      action:ActionsEnum,
      options:WordOptions = {
      },
    ) {
      this.wordList.push({
        word,
        action,
        ...options,
      });
    },
    clearFront() {
      this.wordList.shift();
    },
    clearWords() {
      this.wordList.splice(0);
    },
  },
});
