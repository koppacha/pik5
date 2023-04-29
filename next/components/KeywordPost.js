import {Box, Typography} from "@mui/material";

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
                {props.data.content}
            </Box>
        </>
    )
}