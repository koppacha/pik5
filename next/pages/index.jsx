import Head from 'next/head'
import { Inter } from '@next/font/google'
import styles from '@/styles/Home.module.css'
import Link from "next/link";
import Stage_id from "./stage/[...stage]";
import Navigation from "../components/Layouts/Navigation";

const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  return (
    <>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
        <main className={styles.main}>
            ああああ<br/>
            <Link href="/login">Login</Link>
            <Link href="/register">Register</Link>
            <Link href="/stage/201">こてしらべの洞窟</Link>
            <Link href="/stage/202">新参者の試練場</Link>
            <Link href="/stage/203">神々のおもちゃ箱</Link>
        </main>
    </>
  )
}
