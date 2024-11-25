import {useEffect, useState} from "react";

export const useFetchToken = () => {
    const [token, setToken] = useState('');

    useEffect(() => {
        const fetchToken = async () => {
            try {
                const res = await fetch('/api/token');
                if (!res.ok) {
                    console.error('Token fetch failed');
                    return;
                }
                const data = await res.json();
                setToken(data.token);
            } catch (e) {
                console.error(e);
            }
        };

        fetchToken().then(() => null);
    }, []);

    return token;
};