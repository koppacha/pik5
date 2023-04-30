import {Box, Typography} from "@mui/material";
import Button from "@mui/material/Button";

export default function KeywordPost(props) {

    return (
        <>
            <Typography variant="h5" sx={{
                    fontFamily:['"M PLUS 1 CODE"'].join(","),
            }}>{props.data.keyword}</Typography>
            <Box sx={{
                borderTop:"1px solid #fff",
                marginBottom:"40px",
                padding:"8px"
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