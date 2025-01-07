import React, {useEffect, useState} from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import {Autocomplete, Box, FormHelperText, MenuItem, Typography} from "@mui/material";
import {Controller, useForm} from "react-hook-form";
import * as yup from 'yup'
import {yupResolver} from "@hookform/resolvers/yup";
import useSWR from "swr";
import {currentYear, fetcher, range, sliceObject, useLocale} from "../../lib/pik5";
import NowLoading from "../NowLoading";
import {StyledDialogContent, StyledTextField} from "../../styles/pik5.css";
import {useSession} from "next-auth/react";
import {selectable} from "../../lib/const";
import {useRouter} from "next/router";

export default function ModalCompare({open, handleClose, param}) {

    const {t} = useLocale()
    const {data: session } = useSession()
    const consoleList = [0, 1, 2, 3, 4]
    const years = range(2014, currentYear()).reverse()

    const [rule, setRule] = useState(0)
    const [consoles1, setConsole1] = useState(0)
    const [consoles2, setConsole2] = useState(0)
    const [year1, setYear1] = useState(currentYear())
    const [year2, setYear2] = useState(currentYear())
    const [user1, setUser1] = useState("")
    const [user2, setUser2] = useState("")
    const route = useRouter()
    const {control,
           register,
           handleSubmit,
           reset} = useForm()

    // URLを組み立て遷移する
    const onSubmit = async () => {
        handleClose()
        await route.push("/compare/" + [user1, consoles1, rule, year1, user2, consoles2, rule, year2].join("/"))
    }

    useEffect(() => {
        reset({
            defaultValue: {
                rule: param?.rule1,
                console1: param?.consoles1,
                console2: param?.consoles2,
                year1: param?.year1,
                year2: param?.year2,
            }
        })
        setRule(param?.rule1)
        setConsole1(param?.consoles1)
        setConsole2(param?.consoles2)
        setYear1(param?.year1)
        setYear2(param?.year2)
        setUser1(param?.user1)
        setUser2(param?.user2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <>
            <Dialog open={open} onClose={handleClose}>
                <StyledDialogContent>
                    <DialogTitle>スコアを比較する</DialogTitle>

                    <TextField
                        {...register('rule')}
                        select
                        id="rule"
                        label="ルール"
                        onChange={(e) => setRule(e.target.value)}
                        fullWidth
                        variant="standard"
                        defaultValue={param?.rule1}
                        helperText={""}
                        margin="normal"
                    >
                        {
                            selectable.map((rule) =>
                                <MenuItem key={rule} value={rule}>{t.rule[rule]}</MenuItem>
                            )
                        }
                    </TextField>

                    <Box style={{borderRadius:"8px",padding:"1em",backgroundColor:"#5b5b5b"}}>
                        <Typography>1人目（左）</Typography>
                        <Controller
                            control={control}
                            name="userSearch"
                            render={() => (
                                <Autocomplete
                                    {...register('user1')}
                                    style={{display:"inline-block"}}
                                    options={param.users}
                                    defaultValue={param.users.find(e => e.userId === param.user1) ?? null}
                                    fullWidth
                                    getOptionLabel={(option) => option.name}
                                    getOptionKey={(option) => option.userId}
                                    renderInput={(params) =>
                                        <>
                                            <FormHelperText className="form-helper-text">{t.g.userName}</FormHelperText>
                                            <StyledTextField {...params}/>
                                        </>}
                                    onChange={(event, value) => {
                                        setUser1(value?.userId)
                                    }}
                                />
                            )}
                        />
                        <TextField
                            {...register('console1')}
                            select
                            id="console1"
                            label="操作方法"
                            onChange={(e) => setConsole1(e.target.value)}
                            fullWidth
                            variant="standard"
                            defaultValue={consoleList[param?.consoles1]}
                            helperText={""}
                            margin="normal"
                        >
                            {
                                consoleList.map((key) =>
                                    <MenuItem key={key} value={key}>{t.console[key]}</MenuItem>
                                )
                            }
                        </TextField>
                        <TextField
                            {...register('year1')}
                            select
                            id="year1"
                            label="集計年"
                            onChange={(e) => setYear1(e.target.value)}
                            fullWidth
                            variant="standard"
                            defaultValue={param?.year1}
                            helperText={""}
                            margin="normal"
                        >
                            {
                                years.map((year) =>
                                    <MenuItem key={year} value={year}>{year}</MenuItem>
                                )
                            }
                        </TextField>
                    </Box>
                    <Box style={{borderRadius:"8px",padding:"1em",backgroundColor:"#8a8a8a"}}>
                        <Typography>2人目（右）</Typography>
                        <Controller
                            control={control}
                            name="userSearch"
                            render={() => (
                                <Autocomplete
                                    {...register('user2')}
                                    style={{display:"inline-block"}}
                                    options={param.users}
                                    fullWidth
                                    getOptionLabel={(option) => option.name}
                                    getOptionKey={(option) => option.userId}
                                    defaultValue={param.users.find(e => e.userId === param.user2) ?? null}
                                    renderInput={(params) =>
                                        <>
                                            <FormHelperText className="form-helper-text">{t.g.userName}</FormHelperText>
                                            <StyledTextField {...params}/>
                                        </>}
                                    onChange={(event, value) => {
                                        setUser2(value?.userId)
                                    }}
                                />
                            )}
                        />
                        <TextField
                            {...register('console2')}
                            select
                            id="console2"
                            label="操作方法"
                            onChange={(e) => setConsole2(e.target.value)}
                            fullWidth
                            variant="standard"
                            defaultValue={consoleList[param?.consoles2]}
                            helperText={""}
                            margin="normal"
                        >
                            {
                                consoleList.map((key) =>
                                    <MenuItem key={key} value={key}>{t.console[key]}</MenuItem>
                                )
                            }
                        </TextField>
                        <TextField
                            {...register('year2')}
                            select
                            id="year2"
                            label="集計年"
                            onChange={(e) => setYear2(e.target.value)}
                            fullWidth
                            variant="standard"
                            defaultValue={param?.year2}
                            helperText={""}
                            margin="normal"
                        >
                            {
                                years.map((year) =>
                                    <MenuItem key={year} value={year}>{year}</MenuItem>
                                )
                            }
                        </TextField>
                    </Box>

                <DialogActions>
                    <Button onClick={handleClose}>{t.g.close}</Button>
                    <Button onClick={handleSubmit(onSubmit)}>{t.g.submit}</Button>
                </DialogActions>
                </StyledDialogContent>
            </Dialog>
        </>
    );
}
