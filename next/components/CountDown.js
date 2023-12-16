import {useEffect, useState} from "react";

export default function CountDown({ endTime }) {
    const calculateTimeLeft = () => {
        const now = new Date();
        const difference = new Date(endTime) - now;

        if (difference <= 0) {
            // カウントダウンが終了した場合
            clearInterval(intervalId);
            return '00:00:00';
        }

        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);

        return (
            hours.toString().padStart(2, '0') +
            ':' +
            minutes.toString().padStart(2, '0') +
            ':' +
            seconds.toString().padStart(2, '0')
        );
    };

    const [time, setTime] = useState(calculateTimeLeft);

    useEffect(() => {
        const intervalId = setInterval(() => setTime(calculateTimeLeft), 1000);

        return () => {
            clearInterval(intervalId);
        };
    }, [endTime]); // ← この dependency を削除

    // クライアントサイドで初めてレンダリングされるときに setInterval をセット
    useEffect(() => {
        const intervalId = setInterval(() => setTime(calculateTimeLeft), 1000);

        return () => {
            clearInterval(intervalId);
        };
    }, []); // ← 空の dependency 配列を使用して初回のみ実行

    return <>{time}</>;
}