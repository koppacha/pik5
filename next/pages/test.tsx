import React, {useEffect, useState} from "react";
import axios from "../server/axios";

function App() {
    const [movie, setMovie] = useState([]);

    useEffect(() => {
        async function fetchData() {
            return await axios.get('record/201');
        }
        fetchData().then(r => );
    }, []);
}