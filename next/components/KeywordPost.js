import {Box, Typography} from "@mui/material";
import Button from "@mui/material/Button";
import ReactMarkdown from "react-markdown";

export default function KeywordPost({data, handleEdit}) {

    return (
        <>
            <Button variant="outlined">{data.tag}</Button><br/>
            #{data.unique_id}<br/>
            <Typography variant="" className="mini-title">{data.keyword}</Typography><br/>
            <Box style={{
                borderTop:"1px solid #fff",
                marginBottom:"40px",
                padding:"8px",
                lineHeight:"1.6em"
            }}>
                <ReactMarkdown>
                {
                    // キーワード本文は改行コードをbrタグに変換する
                    data.content
                }
                </ReactMarkdown>
                <Button
                    variant="outlined"
                    value={data.id}
                    onClick={handleEdit()}
                >
                    編集
                </Button>
            </Box>
        </>
    )
}