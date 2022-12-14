<template>
  <ag-grid-vue
    class="ag-theme-alpine text-xl"
    :getRowId="getRowId"
    :columnDefs="columnDefs"
    :rowData="rowData"
    :context="gridContext"
    @grid-ready="onGridReady" />

</template>

<script lang="ts" setup>
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import {
  watch, onBeforeMount, ref, toRaw,
} from 'vue';
import { AgGridVue } from 'ag-grid-vue3';
import MarkLearned from '@components/MarkLearned.vue';
import AddToCardQueue from '@components/AddToCardQueue.vue';
import { getUserSettings } from '@/renderer/UserSettings';
import type { GetRowIdParams, GridReadyEvent, ColDef } from 'ag-grid-community';
import type { UnknownWordEntry } from '@/shared/types';

const UserSettings = getUserSettings();

const props = defineProps<{
  words: UnknownWordEntry[],
  // Should be something like booksource
  bookFilter?: number,
}>();

const getRowId = (params:GetRowIdParams) => params.data.word;

const gridContext = {
  bookId: props.bookFilter,
};

function onGridReady(params:GridReadyEvent) {
  params.api.sizeColumnsToFit();
  window.addEventListener('resize', () => {
    setTimeout(() => {
      params.api.sizeColumnsToFit();
    });
  });
  params.api.sizeColumnsToFit();
}

const columnDefs:ColDef[] = [
  {
    headerName: 'word',
    field: 'word',
    width: 80,
    minWidth: 80,
    cellClass: 'text-xl',
  },
  {
    headerName: 'pinyin',
    field: 'pinyin',
    width: 100,
    cellClass: [
      'border-2',
      'text-opacity-0',
      'text-black',
      'hover:text-opacity-100',
    ],
  },
  {
    headerName: 'occurance',
    field: 'occurance',
    sort: 'desc',
    width: 50,
    minWidth: 50,
  },
];

const showDefinitions = UserSettings.Dictionaries.ShowDefinitions.read();
if (showDefinitions) {
  columnDefs.push(
    {
      headerName: 'definition',
      field: 'definition',
      minWidth: 400,
    },
  );
}

columnDefs.push(
  {
    headerName: '',
    field: 'markButton',
    width: 120,
    cellRenderer: MarkLearned,
  },
);
columnDefs.push(
  {
    headerName: '',
    field: 'Make FlashCard',
    width: 120,
    cellRenderer: AddToCardQueue,
    cellRendererParams: {
      text: 'Create FlashCard',
      create: true,
    },
  },
);

const rowData = ref<any[]>([]);
watch(() => props.words, async (newWords) => {
  rowData.value = await window.ipc.getDefinitions(toRaw(newWords));
  console.log('new Words', rowData.value);
});

onBeforeMount(async () => {
  const rawWords = toRaw(props.words);
  rowData.value = await window.ipc.getDefinitions(rawWords);
  console.log(rowData);
});
</script>
