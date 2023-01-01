<template>
  <div>
    <h2>List</h2>
    <ul v-for="(book, i) in books" :key="i">
      <li>{{ book.title }}</li>
      <nuxt-link :to="{ name: 'book-detail-id', params: { id: book.id } }">
        <button>詳細</button>
      </nuxt-link>
      <button @click="onClickDelete(book.id)">削除</button>
    </ul>

    <h3>新規追加</h3>
    <input v-model="form.title" type="text" placeholder="title" /><br/>
    <input v-model="form.author" type="text" placeholder="author"/><br/>
    <button @click="onClickAdd">追加</button>
  </div>
</template>

<script>
import Vue from 'vue'
import { BookService, BookResponse } from '@/service/book'


interface Form {
  title: string
  author: string
}
type Book = BookResponse

interface DataType {
  form: Form
  books: Book[]
}

export default Vue.extend({
  async asyncData(){
    const books = await BookService.fetchBooks()
    return {
      books,
    }
  },
  data(): DataType {
    return {
      form: { title: '', author: '' },
      books: [],
    }
  },
  methods: {
    async onClickAdd() {
      await BookService.postBookData({...this.form})
      this.books = await BookService.fetchBook()
      this.form = { title: '', author: '' }
    },
    async onClickDelete(bookId: number) {
      await BookService.deleteBook(bookId)
      this.books = await BookService.fetchBook()
    }
  }
})
</script>