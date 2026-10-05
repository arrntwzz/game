const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const count = document.getElementById("count");
const emoteContainer = document.getElementById("emotes");
const minimap = document.getElementById("minimap");
const minimapCtx = minimap.getContext("2d");

const map = new Image();
map.src = "assets/map.png";

const world = {
    width: 2000,
    height: 2000
};

let x = 1000;
let y = 1000;
let playerRadius = 20;

const speed = 8;

let foodCount = 0;
let myNickname = "";

let food = {
    x: 1200,
    y: 1000,
    radius: 12
};

let camera = {
    x: 0,
    y: 0
};

let targetX = x;
let targetY = y;
let hasTarget = false;

let myId = null;
let players = {};

let lastSentX = x;
let lastSentY = y;
let lastSentRadius = playerRadius;

let lastFoodRequest = 0;

const playerId =
    localStorage.getItem("playerId") ||
    crypto.randomUUID();

localStorage.setItem(
    "playerId",
    playerId
);

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    resizeMinimap();
}

resizeCanvas();

window.addEventListener(
    "resize",
    resizeCanvas
);

const protocol =
    location.protocol === "https:"
        ? "wss:"
        : "ws:";

const socket = new WebSocket(
    `${protocol}//${location.host}?playerId=${encodeURIComponent(playerId)}`
);

socket.addEventListener(
    "open",
    () => {
        console.log("Connected");
    }
);

socket.addEventListener(
    "close",
    () => {
        console.log("Disconnected");
    }
);

socket.addEventListener(
    "error",
    error => {
        console.error(
            "WebSocket error:",
            error
        );
    }
);

socket.addEventListener(
    "message",
    event => {
        const data =
            JSON.parse(event.data);

        if (data.type === "init") {
            myId = data.id;

            food.x = data.food.x;
            food.y = data.food.y;
            food.radius =
                data.food.radius;

            players = {};

            for (
                const id in data.players
            ) {
                const player =
                    data.players[id];

                if (
                    String(id) ===
                    String(myId)
                ) {
                    x = player.x;
                    y = player.y;
                    playerRadius =
                        player.radius;
                    foodCount =
                        player.foodCount;
                    myNickname =
                        player.nickname;

                    targetX = x;
                    targetY = y;
                    hasTarget = false;
                } else {
                    players[id] = {
                        x: player.x,
                        y: player.y,
                        radius:
                            player.radius,
                        foodCount:
                            player.foodCount,
                        nickname:
                            player.nickname
                    };
                }
            }

            count.textContent =
                `Food: ${foodCount} | ${myNickname}`;

            lastSentX = x;
            lastSentY = y;
            lastSentRadius =
                playerRadius;
        }

        if (data.type === "join") {
            if (
                String(data.id) !==
                String(myId)
            ) {
                players[data.id] = {
                    x: data.x,
                    y: data.y,
                    radius: data.radius,
                    foodCount:
                        data.foodCount,
                    nickname:
                        data.nickname
                };
            }
        }

        if (data.type === "move") {
            if (
                String(data.id) !==
                String(myId)
            ) {
                if (!players[data.id]) {
                    players[data.id] = {
                        x: data.x,
                        y: data.y,
                        radius:
                            data.radius,
                        foodCount:
                            data.foodCount,
                        nickname:
                            data.nickname ||
                            `Player_${data.id}`
                    };
                }

                players[data.id].x =
                    data.x;

                players[data.id].y =
                    data.y;

                players[data.id].radius =
                    data.radius;

                if (
                    data.foodCount !==
                    undefined
                ) {
                    players[data.id]
                        .foodCount =
                        data.foodCount;
                }

                if (data.nickname) {
                    players[data.id]
                        .nickname =
                        data.nickname;
                }
            }
        }

        if (
            data.type ===
            "foodEaten"
        ) {
            food.x =
                data.food.x;

            food.y =
                data.food.y;

            food.radius =
                data.food.radius;

            if (
                String(
                    data.playerId
                ) === String(myId)
            ) {
                playerRadius =
                    data.radius;

                foodCount =
                    data.foodCount;

                count.textContent =
                    `Food: ${foodCount} | ${myNickname}`;

                lastSentRadius =
                    playerRadius;
            }

            if (
                players[data.playerId]
            ) {
                players[data.playerId]
                    .radius =
                    data.radius;

                players[data.playerId]
                    .foodCount =
                    data.foodCount;
            }
        }

        if (data.type === "leave") {
            delete players[data.id];
        }

        if (data.type === "emote") {
            showEmote(
                data.nickname,
                data.emoji
            );
        }
    }
);

function sendPosition() {
    if (
        socket.readyState !==
        WebSocket.OPEN
    ) {
        return;
    }

    socket.send(
        JSON.stringify({
            type: "move",
            x,
            y,
            radius: playerRadius
        })
    );
}

function tryEatFood() {
    if (
        socket.readyState !==
        WebSocket.OPEN
    ) {
        return;
    }

    const now =
        performance.now();

    if (
        now - lastFoodRequest <
        150
    ) {
        return;
    }

    const distance =
        Math.hypot(
            x - food.x,
            y - food.y
        );

    if (
        distance <=
        playerRadius +
        food.radius +
        5
    ) {
        lastFoodRequest = now;

        socket.send(
            JSON.stringify({
                type: "eatFood"
            })
        );
    }
}

function sendEmote(emoji) {
    if (
        socket.readyState !==
        WebSocket.OPEN
    ) {
        return;
    }

    socket.send(
        JSON.stringify({
            type: "emote",
            emoji
        })
    );
}

function showEmote(
    nickname,
    emoji
) {
    const message =
        document.createElement(
            "div"
        );

    message.className =
        "emote-message";

    message.innerHTML = `
        <span class="emote-name">${escapeHtml(nickname)}</span>
        <span class="emote-emoji">${emoji}</span>
    `;

    emoteContainer.appendChild(
        message
    );

    while (
        emoteContainer.children
            .length > 6
    ) {
        emoteContainer.removeChild(
            emoteContainer
                .firstChild
        );
    }

    setTimeout(() => {
        message.classList.add(
            "fade-out"
        );

        setTimeout(() => {
            message.remove();
        }, 400);
    }, 2500);
}

function escapeHtml(text) {
    return String(text)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}

function setupMouseControls() {
    canvas.addEventListener(
        "click",
        () => {
            if (
                document.pointerLockElement !==
                canvas
            ) {
                canvas.requestPointerLock();
            }
        }
    );

    document.addEventListener(
        "mousemove",
        e => {
            if (
                document.pointerLockElement !==
                canvas
            ) {
                return;
            }

            const sensitivity = 2;

            targetX +=
                e.movementX *
                sensitivity;

            targetY +=
                e.movementY *
                sensitivity;

            targetX = Math.max(
                playerRadius,
                Math.min(
                    world.width -
                        playerRadius,
                    targetX
                )
            );

            targetY = Math.max(
                playerRadius,
                Math.min(
                    world.height -
                        playerRadius,
                    targetY
                )
            );

            hasTarget = true;
        }
    );

    document.addEventListener(
        "pointerlockchange",
        () => {
            if (
                document.pointerLockElement !==
                canvas
            ) {
                hasTarget = false;
                targetX = x;
                targetY = y;
            }
        }
    );
}

function setupTouchControls() {
    canvas.addEventListener(
        "touchstart",
        e => {
            e.preventDefault();

            const touch =
                e.touches[0];

            const rect =
                canvas.getBoundingClientRect();

            targetX =
                camera.x +
                touch.clientX -
                rect.left;

            targetY =
                camera.y +
                touch.clientY -
                rect.top;

            targetX = Math.max(
                playerRadius,
                Math.min(
                    world.width -
                        playerRadius,
                    targetX
                )
            );

            targetY = Math.max(
                playerRadius,
                Math.min(
                    world.height -
                        playerRadius,
                    targetY
                )
            );

            hasTarget = true;
        },
        {
            passive: false
        }
    );

    canvas.addEventListener(
        "touchmove",
        e => {
            e.preventDefault();

            const touch =
                e.touches[0];

            const rect =
                canvas.getBoundingClientRect();

            targetX =
                camera.x +
                touch.clientX -
                rect.left;

            targetY =
                camera.y +
                touch.clientY -
                rect.top;

            targetX = Math.max(
                playerRadius,
                Math.min(
                    world.width -
                        playerRadius,
                    targetX
                )
            );

            targetY = Math.max(
                playerRadius,
                Math.min(
                    world.height -
                        playerRadius,
                    targetY
                )
            );

            hasTarget = true;
        },
        {
            passive: false
        }
    );

    canvas.addEventListener(
        "touchend",
        e => {
            e.preventDefault();
            hasTarget = false;
        },
        {
            passive: false
        }
    );

    canvas.addEventListener(
        "touchcancel",
        e => {
            e.preventDefault();
            hasTarget = false;
        },
        {
            passive: false
        }
    );
}

function setupEmotes() {
    document.addEventListener(
        "keydown",
        e => {
            if (e.repeat) {
                return;
            }

            if (
                e.key === "1" ||
                e.code === "Digit1" ||
                e.code === "Numpad1"
            ) {
                sendEmote("😂");
                return;
            }

            if (
                e.key === "2" ||
                e.code === "Digit2" ||
                e.code === "Numpad2"
            ) {
                sendEmote("😡");
                return;
            }

            if (
                e.key === "3" ||
                e.code === "Digit3" ||
                e.code === "Numpad3"
            ) {
                sendEmote("😞");
            }
        }
    );

    document
        .getElementById("emote1")
        .addEventListener(
            "click",
            () => {
                sendEmote("😂");
            }
        );

    document
        .getElementById("emote2")
        .addEventListener(
            "click",
            () => {
                sendEmote("😡");
            }
        );

    document
        .getElementById("emote3")
        .addEventListener(
            "click",
            () => {
                sendEmote("😞");
            }
        );
}

function setupControls() {
    if (
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0
    ) {
        setupTouchControls();
    } else {
        setupMouseControls();
    }

    setupEmotes();
}

function drawFood() {
    ctx.beginPath();

    ctx.arc(
        food.x,
        food.y,
        food.radius,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = "red";
    ctx.fill();
}

function drawMap() {
    ctx.drawImage(
        map,
        0,
        0,
        world.width,
        world.height
    );
}

function drawPlayer(
    px,
    py,
    radius,
    color,
    nickname
) {
    ctx.beginPath();

    ctx.arc(
        px,
        py,
        radius,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = color;
    ctx.fill();

    if (nickname) {
        ctx.font =
            "bold 14px Arial";

        ctx.textAlign =
            "center";

        ctx.textBaseline =
            "bottom";

        ctx.fillStyle =
            "black";

        ctx.fillText(
            nickname,
            px + 1,
            py - radius - 7 + 1
        );

        ctx.fillStyle =
            "white";

        ctx.fillText(
            nickname,
            px,
            py - radius - 7
        );
    }
}

function drawOtherPlayers() {
    for (
        const id in players
    ) {
        const player =
            players[id];

        drawPlayer(
            player.x,
            player.y,
            player.radius || 20,
            "blue",
            player.nickname
        );
    }
}

function resizeMinimap() {
    const rect =
        minimap.getBoundingClientRect();

    const dpr =
        window.devicePixelRatio ||
        1;

    minimap.width =
        rect.width * dpr;

    minimap.height =
        rect.height * dpr;

    minimapCtx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );
}

function drawMinimap() {
    const width =
        minimap.clientWidth;

    const height =
        minimap.clientHeight;

    minimapCtx.clearRect(
        0,
        0,
        width,
        height
    );

    minimapCtx.fillStyle =
        "rgba(0,0,0,0.65)";

    minimapCtx.fillRect(
        0,
        0,
        width,
        height
    );

    const scaleX =
        width / world.width;

    const scaleY =
        height / world.height;

    if (
        map.complete &&
        map.naturalWidth > 0
    ) {
        minimapCtx.globalAlpha =
            0.55;

        minimapCtx.drawImage(
            map,
            0,
            0,
            width,
            height
        );

        minimapCtx.globalAlpha =
            1;
    }

    minimapCtx.strokeStyle =
        "rgba(255,255,255,0.5)";

    minimapCtx.strokeRect(
        0,
        0,
        width,
        height
    );

    minimapCtx.beginPath();

    minimapCtx.arc(
        food.x * scaleX,
        food.y * scaleY,
        4,
        0,
        Math.PI * 2
    );

    minimapCtx.fillStyle =
        "red";

    minimapCtx.fill();

    for (
        const id in players
    ) {
        const player =
            players[id];

        minimapCtx.beginPath();

        minimapCtx.arc(
            player.x * scaleX,
            player.y * scaleY,
            4,
            0,
            Math.PI * 2
        );

        minimapCtx.fillStyle =
            "blue";

        minimapCtx.fill();
    }

    minimapCtx.beginPath();

    minimapCtx.arc(
        x * scaleX,
        y * scaleY,
        5,
        0,
        Math.PI * 2
    );

    minimapCtx.fillStyle =
        "pink";

    minimapCtx.fill();

    minimapCtx.strokeStyle =
        "white";

    minimapCtx.stroke();
}

function updateMovement() {
    if (!hasTarget) {
        return;
    }

    const dx =
        targetX - x;

    const dy =
        targetY - y;

    const distance =
        Math.hypot(
            dx,
            dy
        );

    if (
        distance <= speed
    ) {
        x = targetX;
        y = targetY;
        hasTarget = false;
        return;
    }

    x +=
        (dx / distance) *
        speed;

    y +=
        (dy / distance) *
        speed;
}

function updateCamera() {
    camera.x += (
        x -
        canvas.width / 2 -
        camera.x
    ) * 0.08;

    camera.y += (
        y -
        canvas.height / 2 -
        camera.y
    ) * 0.08;

    camera.x = Math.max(
        0,
        Math.min(
            Math.max(
                0,
                world.width -
                    canvas.width
            ),
            camera.x
        )
    );

    camera.y = Math.max(
        0,
        Math.min(
            Math.max(
                0,
                world.height -
                    canvas.height
            ),
            camera.y
        )
    );
}

function game() {
    updateMovement();

    x = Math.max(
        playerRadius,
        Math.min(
            world.width -
                playerRadius,
            x
        )
    );

    y = Math.max(
        playerRadius,
        Math.min(
            world.height -
                playerRadius,
            y
        )
    );

    updateCamera();

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.save();

    ctx.translate(
        -camera.x,
        -camera.y
    );

    drawMap();
    drawFood();
    drawOtherPlayers();

    drawPlayer(
        x,
        y,
        playerRadius,
        "pink",
        myNickname
    );

    ctx.restore();

    tryEatFood();

    if (
        Math.abs(
            x - lastSentX
        ) > 1 ||
        Math.abs(
            y - lastSentY
        ) > 1 ||
        playerRadius !==
            lastSentRadius
    ) {
        sendPosition();

        lastSentX = x;
        lastSentY = y;
        lastSentRadius =
            playerRadius;
    }

    drawMinimap();

    requestAnimationFrame(game);
}

document.addEventListener(
    "wheel",
    e => {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    },
    {
        passive: false
    }
);

document.addEventListener(
    "keydown",
    e => {
        if (
            e.ctrlKey &&
            (
                e.key === "+" ||
                e.key === "-" ||
                e.key === "=" ||
                e.key === "0"
            )
        ) {
            e.preventDefault();
        }
    }
);

setupControls();

map.onload = () => {
    resizeMinimap();
    game();
};
