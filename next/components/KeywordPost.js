import {Box, Typography} from "@mui/material";
import Button from "@mui/material/Button";

export default function KeywordPost(props) {

    return (
        <>
            <Typography variant="" className="mini-title">{props.data.keyword}</Typography><br/>
            <Button variant="outlined">{props.data.tag}</Button>
            <Box style={{
                borderTop:"1px solid #fff",
                marginBottom:"40px",
                padding:"8px",
                lineHeight:"1.6em"
            }}>
                {
                    // キーワード本文は改行コードをbrタグに変換する
                    props.data.content.split('\n').map(t => (<span>{t}<br /></span>))
                }
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