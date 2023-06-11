import {Box, Typography} from "@mui/material";
import Button from "@mui/material/Button";
import ReactMarkdown from "react-markdown";

export default function KeywordPost(props) {

    return (
        <>
            <Button variant="outlined">{props.data.tag}</Button><br/>
            #{props.data.unique_id}<br/>
            <Typography variant="" className="mini-title">{props.data.keyword}</Typography><br/>
            <Box style={{
                borderTop:"1px solid #fff",
                marginBottom:"40px",
                padding:"8px",
                lineHeight:"1.6em"
            }}>
                <ReactMarkdown>
                {
                    // キーワード本文は改行コードをbrタグに変換する
                    props.data.content
                }
                </ReactMarkdown>
                <Button
                    variant="outlined"
                    value={props.data.id}
                    onClick={props.handleEdit()}
                >
                    編集
                </Button>
            </Box>
        </>
    )
}