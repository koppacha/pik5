import Head from "next/head"

const gameUrl = "/games/mitite_shooting_simulator_build/index.html"

export default function MititeShootingSimulator(){
    return (
        <>
            <Head>
                <title>mitite shooting simulator - Pik5</title>
            </Head>
            <main className="game-page">
                <iframe
                    className="game-frame"
                    src={gameUrl}
                    title="mitite shooting simulator"
                    allow="fullscreen; gamepad; autoplay; pointer-lock"
                    allowFullScreen
                />
            </main>
            <style jsx>{`
                .game-page {
                    width: 100%;
                    min-height: calc(100vh - 120px);
                    display: flex;
                    background: #111;
                }

                .game-frame {
                    width: 100%;
                    min-height: calc(100vh - 120px);
                    border: 0;
                    background: #231f20;
                }

                @media (max-width: 700px) {
                    .game-page,
                    .game-frame {
                        min-height: calc(100vh - 72px);
                    }
                }
            `}</style>
        </>
    )
}
