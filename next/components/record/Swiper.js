import {animated, useSpring} from "react-spring";
import React, {useState} from "react";
import {useDrag} from "@use-gesture/react";

const SwiperTooltip = ({ message }) => (
    <div style={{ position: 'absolute', top: '-65px', left: '15px', background: '#e0e0e0', color: '#444444', padding: '10px', borderRadius: '8px' }}>
        {message ?? ""}
    </div>
)

// スワイプメニュー
export const Swiper = ({ children, stageLink, userPageUrl, router }) => {
    const [{x, bg, scale, justifySelf}, api] = useSpring(() => ({
        x: 0,
        scale: 1,
        justifySelf: 'center',
    }))
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipMessage, setTooltipMessage] = useState('');
    const bind = useDrag(({ active, cancel, movement: [mx, my], elapsedTime: t }) => {
    let pushUrl = ""
        if(!active){
            // 最初にタッチした座標と移動先の座標の２点間角度が45度以上ならスワイプメニューを動作させる
            const angleFlag = Math.abs(Math.atan2(my, mx)) <= 45

            // 左ヘスワイプした場合の動作
            if(t > 50 && mx > 150 && angleFlag){
                pushUrl = userPageUrl

            // 右へスワイプした場合の動作
            } else if(t > 50 && mx < -150 && angleFlag){
                pushUrl = stageLink
            } else {
                api.start({x: 0, scale: 1})
            }
        } else {
            // if (Math.abs(mx) > 0 && Math.abs(mx) < 100) {
            //     setTooltipMessage(mx > 0 ? `ユーザーページへ→` : stageLink ? `←ステージページへ` : "移動できません！");
            //     setShowTooltip(true);
            //     setTimeout(() => {
            //         setShowTooltip(false);
            //     }, 1000)
            // } else {
            //     setShowTooltip(false);
            // }
            api.start({
                x: mx,
                scale: active ? 1.1 : 1,
                immediate: name => active && name === 'x',
            });
            if(pushUrl){
                cancel()
                router.push(pushUrl).then(setShowTooltip(false))
            }
        }
    })
    const aSize = x.to({
        map: Math.abs,
        range: [50, 300],
        output: [0.5, 1],
        extrapolate: 'clamp',
    })
    return (
        <animated.div {...bind()} style={{
            touchAction: 'none',
            position: 'relative'
        }}>
            <animated.div style={{scale: aSize, justifySelf}}/>
            <animated.div style={{x, scale}}>
                {children}
            </animated.div>
            {showTooltip && <SwiperTooltip message={tooltipMessage}/>}
        </animated.div>
    )
}