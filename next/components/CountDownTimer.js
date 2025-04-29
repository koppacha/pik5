import { useState, useEffect } from "react";

const CountdownTimer = ({ startTime, endTime }) => {
    const [timeLeft, setTimeLeft] = useState(getTimeLeft());

    function getTimeLeft() {
        const now = new Date();
        const start = new Date(startTime);
        const end = new Date(endTime);

        if (now >= end) {
            return { message: "終了しました", color: "#fff" };
        }

        const target = now < start ? start : end;
        const diff = target - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return {
            prefix: now < start ? "開始まで：" : "終了まで：",
            days,
            hours,
            minutes,
            seconds,
            color: now < start ? "#888" : "#fff",
        };
    }

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(getTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    if (timeLeft.message) {
        return <div style={{ color: timeLeft.color }}>{timeLeft.message}</div>;
    }

    return (
        <div style={{ color: timeLeft.color }}>
            {timeLeft.prefix}
            {timeLeft.days > 0 ? `${timeLeft.days} Day ` : ""}
            {String(timeLeft.hours).padStart(2, "0")}:
            {String(timeLeft.minutes).padStart(2, "0")}:
            {String(timeLeft.seconds).padStart(2, "0")}
        </div>
    );
};

export default CountdownTimer;