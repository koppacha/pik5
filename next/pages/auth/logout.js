import { GetStaticProps } from "next"
import { signOut } from "next-auth/react"
import React from "react"
import { logger } from "../../lib/logger"

export default function logout({ callbackUrl }) {
    logger.debug(`callbackUrl`);
    logger.debug(callbackUrl);
    signOut({ callbackUrl });
    return <div></div>;
}

export const getStaticProps = async (GetStaticProps) => ({
    props: { callbackUrl: process.env.NEXTAUTH_URL }, // will be passed to the page component as props
});
