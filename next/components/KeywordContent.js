import Button from "@mui/material/Button";
import {Box, Typography} from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function KeywordContent({data}){

    return (
        <>
            <Button variant="outlined">{data.tag}</Button><br/>
            #{data.unique_id}<br/>
            <Typography variant="" className="mini-title">{data.keyword}</Typography><br/>
            <Box style={{
                borderTop: "1px solid #fff",
                marginBottom: "40px",
                padding: "30px",
                lineHeight: "1.6em",
                minHeight: "1000px"
            }}>
                <ReactMarkdown
                    className="markdown-content"
                    remarkPlugins={[remarkGfm]}>
                    {data.content}
                </ReactMarkdown>
                <Button
                    variant="outlined"
                    value={data.id}
                    // onClick={handleEdit()}
                >
                    編集
                </Button>
            </Box>
        </>
    )
}