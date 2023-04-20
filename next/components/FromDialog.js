import React, {useState, useRef} from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import {Box} from "@mui/material";

export default function FormDialog() {

    const [open, setOpen] = useState(false)
    const [keyword, setKeyword] = useState("")
    const [yomi, setYomi] = useState("")
    const [content, setContent] = useState("")

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    const handleSubmit = async () => {
            const res = await fetch('http://localhost:8000/api/keyword', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    'keyword': keyword,
                    'yomi': yomi,
                    'content': content
                })
            })
            if(res.status < 300){
                setOpen(false)
            }
        }

    const getCircularReplacer = () => {
        const seen = new WeakSet()
        return (key, value) => {
            if (typeof value === "object" && value !== null) {
                if (seen.has(value)) {
                    return
                }
                seen.add(value)
            }
            return value
        }
    }

    return (
        <div>
            <Button variant="outlined" onClick={handleClickOpen}>
                キーワードを新規作成
            </Button>
            <Dialog open={open} onClose={handleClose}>
                <Box sx={{width:'600px'}}>
                <DialogTitle>キーワードを新規作成する</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        id="keyword"
                        label="キーワード名"
                        type="text"
                        onChange={(e) => setKeyword(e.target.value)}
                        fullWidth
                        variant="standard"
                    />
                </DialogContent>
                <DialogContent>
                    <TextField
                        id="yomi"
                        label="よみがな"
                        type="text"
                        onChange={(e) => setYomi(e.target.value)}
                        fullWidth
                        variant="standard"
                    />
                </DialogContent>
                <DialogContent>
                    <TextField
                        id="content"
                        label="本文"
                        type="text"
                        onChange={(e) => setContent(e.target.value)}
                        fullWidth
                        multiline
                        rows={5}
                        variant="standard"
                    />
                </DialogContent>

                <DialogActions>
                    <Button onClick={handleClose}>キャンセル</Button>
                    <Button onClick={handleSubmit}>送信</Button>
                </DialogActions>
                </Box>
            </Dialog>
        </div>
    );
}
