import React, {useEffect} from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import {Box} from "@mui/material";
import {useForm} from "react-hook-form";
import * as yup from 'yup'
import {yupResolver} from "@hookform/resolvers/yup";
import Image from "next/image";
import YouTube from "react-youtube";

const ag2getParameterByName = function(name, url){
    //ULRをクエリで分割して配列化
    let queryString = url.split('?');
    //URLにクエリがあった場合
    if(queryString.length >= 2){
        //複数のパラメーターがあれば分割して配列化
        let paras = queryString[1].split('&');
        //指定したパラメーターの値を取得
        for(let i = 0; i < paras.length; i++){
            //パラメーターを名前と値で分割
            let eachPara = paras[i].split('=');
            //パラメーター名が指定のものと一致したら値を返して関数処理を終了
            if(eachPara[0] === name) return eachPara[1];
        }
    }
    //URLに指定のパラメーターが無い場合はnullを返す
    return null;
};

export default function ModalDialogVideo({videoOpen, videoHandleClose, url}) {

    let id

    if(url.match(/\?/) != null){
        //URLからID(パラメーター名vの値)の部分を抽出
        id = ag2getParameterByName('v', url) ? ag2getParameterByName('v', url) : false;
    // TODO: ニコニコ動画、Twitter、Twitchも対応の必要あり
    }else if(url.match(/(youtube\.com\/watch|youtu\.be)/) != null){
        //URLにクエリが無く、動画のURLかショートコードの場合
        //URLからIDの部分を抽出
        id = (/https?:\/\/(?:www\.)?(?:youtube\.com\/watch|youtu\.be)\/(.+)/g).exec(url)[1];
    }

    const opts = {
        playerVars: {
            autoplay: 1,
        }
    }
    
    return (
        <>
            <Dialog open={videoOpen} onClose={videoHandleClose}>
                <Box style={{width:1200,height:600,backgroundColor:'transparent'}}>
                    <YouTube
                        videoId={id}
                        src={url}
                        opts={opts}
                    />
                </Box>
            </Dialog>
        </>
    );
}
