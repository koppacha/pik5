import React, { useEffect, useState } from "react";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { styled } from "@mui/material/styles";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faLightbulb, faRankingStar, faUsers} from "@fortawesome/free-solid-svg-icons";
import {Modal, Tooltip} from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import RecordPost from "../modal/RecordPost";
import {CustomButton} from "../../styles/pik5.css";
import Record from "../record/Record";
import useSWR from "swr";
import {addName2posts, fetcher} from "../../lib/pik5";
import NowLoading from "../NowLoading";

// プレミアムステージの背景色（ボーダーカラー）
const gradientColor = "linear-gradient(145deg, rgba(255,157,2,1) 0%, rgba(241,221,10,1) 65%, rgba(164,250,247,1) 100%)"

const CardWrapper = styled(Paper)(({ premium }) => ({
    width: 280,
    height: 382,
    padding: 10,
    borderRadius: 16,
    background: `${premium}`,
    boxShadow: "4px 4px 10px rgba(0, 0, 0, 0.1)",
    transform: `rotate(2deg)`,
    transition: "transform 0.3s ease-in-out",
    position: "relative",
    zIndex: 1,
}));

const CardBackground = styled(Box)({
    width: 280,
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#e1e1e1",
    borderRadius: 12,
    boxShadow: "4px 4px 10px rgba(0, 0, 0, 0.1)",
    transform: "rotate(0deg)",
    zIndex: 0,
});

const level2color = (level) => {
    switch (level) {
        case 1:
            return "#777";
        case 2:
            return "#777";
        case 3:
            return "#777";
        case 4:
            return "#cc47f1";
        case 5:
            return "#f1477e";
        default:
            return "#777";
    }
}


const CardItem = ({ id, title, subtitle, premium, level, description, users, user, topScore, inventor }) => {
    const [rotation, setRotation] = useState(0);
    const [open, setOpen] = useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    const {data, error} = useSWR(`/api/server/record/1049`, fetcher)

    if(!data || error) return <NowLoading/>

    const datas = addName2posts(data.data, users)

    const style = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: '#000',
        border: '2px solid #000',
        boxShadow: 24,
        pt: 2,
        px: 4,
        pb: 3,
    };

    useEffect(() => {
        // 1度〜10度の範囲でランダムな値を生成（0度は除外）
        let angle = Math.floor(Math.random() * 2) + 2; // 1〜10のランダム整数
        if (Math.random() > 0.5) angle *= -1; // ±をランダム化
        setRotation(angle);
    }, []);

    return (
        <>
            <Grid item onClick={handleOpen} style={{cursor: "pointer"}}>
                <Box position="relative">
                    <CardBackground />
                    <CardWrapper premium={premium ? gradientColor : "#777"}>
                        <div style={{background:"#fff",height:"100%",borderRadius:"16px",padding:"12px",display: "flex", flexDirection: "column"}}>
                            <Grid container style={{fontSize: 12, color: "#4b4b4b"}}>
                                <Grid item xs={3}>#{id}</Grid>
                                <Grid item xs={9} style={{textAlign:"right",color:level2color(level)}}>{"★".repeat(level)}</Grid>
                            </Grid>
                            <div style={{fontSize: 20, fontWeight: "bold"}}>{title}</div>
                            <div style={{fontSize: 16, color: "#666", marginTop: 4}}>{subtitle}</div>
                            <div style={{fontSize: 14, color: "#333", marginTop: 8, marginBottom: 8}}>{description}</div>
                            <div style={{ marginTop: "auto" }}>
                                <hr/>
                                <Grid container style={{fontSize: 14, marginTop: 8}}>
                                    <Grid item xs={2}><Tooltip title={"参加者数"}><FontAwesomeIcon icon={faUsers} /> {user}</Tooltip></Grid>
                                    <Grid item xs={4}><Tooltip title={"トップスコア"}><FontAwesomeIcon icon={faRankingStar} /> {topScore}</Tooltip></Grid>
                                    <Grid item xs={6} style={{textAlign:"right"}}><Tooltip title={"考案者"}><FontAwesomeIcon icon={faLightbulb} /> {inventor}</Tooltip></Grid>
                                </Grid>
                            </div>
                        </div>
                    </CardWrapper>
                </Box>
            </Grid>
            <Modal
                open={open}
                onClose={handleClose}>
                <Box sx={style}>
                    <div style={{
                        width: "98%",
                        border: "1px solid #fff",
                        color: "#fff",
                        textAlign: "center",
                        padding: "8px",
                        borderRadius: "4px"
                    }}>
                        {title}<br/>
                        <ReactMarkdown className="markdown-content mini-content" remarkPlugins={[remarkGfm]}>
                            {description}
                        </ReactMarkdown>

                        <RecordPost
                            style={{alignItems: "center"}}
                            info={data.data} rule={240421} console={0}/>
                        {
                            Object.values(datas).map(function (post) {
                                return <Record mini={true} key={post.unique_id} data={post} parent={parent}/>
                            })
                        }
                    </div>
                </Box>
            </Modal>
        </>
    );
};

const CardGrid = ({cards, users}) => {
    return (
        <Grid container style={{margin:"2em 0"}} spacing={4} justifyContent="center">
            {cards.map((card) => (
                <CardItem key={card.id} {...card} users={users} />
            ))}
        </Grid>
    );
};

export default CardGrid;