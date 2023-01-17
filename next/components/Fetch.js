import React, {useState, useEffect} from 'react';

const Fetch = () => {

    const [posts, setPosts] = useState([]);

    useEffect(() => {
        fetch('http://localhost:8000/api/record/201',
            {
                method : "GET"
            })
            .then(res => res.json())
            .then(data => {
                setPosts(data)
            })
    },[])

    return (
        <div>
            <ul>
                {
                    posts.map(post => <li key={post.post_id}>{post.user_name}</li>)
                }
            </ul>
        </div>
    )
}

export default Fetch