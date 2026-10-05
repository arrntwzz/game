const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT =
    process.env.PORT || 3000;

const world = {
    width: 2000,
    height: 2000
};

const DATA_FILE =
    path.join(
        __dirname,
        "players.json"
    );

let savedPlayers = {};

if (fs.existsSync(DATA_FILE)) {
    try {
        savedPlayers =
            JSON.parse(
                fs.readFileSync(
                    DATA_FILE,
                    "utf8"
                )
            );
    } catch {
        savedPlayers = {};
    }
}

const food = {
    x: 1200,
    y: 1000,
    radius: 12
};

const players = new Map();

let nextId = 1;

for (
    const playerId
    of Object.keys(savedPlayers)
) {
    const numericId =
        Number(
            savedPlayers[playerId].id
        );

    if (
        Number.isInteger(numericId) &&
        numericId >= nextId
    ) {
        nextId =
            numericId + 1;
    }
}

function savePlayers() {
    const data = {};

    for (
        const [
            playerId,
            player
        ] of players
    ) {
        data[playerId] = {
            id: player.id,
            playerId,
            x: player.x,
            y: player.y,
            radius: player.radius,
            foodCount:
                player.foodCount,
            nickname:
                player.nickname
        };
    }

    for (
        const playerId in savedPlayers
    ) {
        if (!data[playerId]) {
            data[playerId] =
                savedPlayers[playerId];
        }
    }

    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(
                data,
                null,
                2
            )
        );

        savedPlayers = data;
    } catch (error) {
        console.error(error);
    }
}

const server =
    http.createServer(
        (req, res) => {
            let requestedPath =
                req.url.split("?")[0];

            let filePath =
                requestedPath === "/"
                    ? path.join(
                          __dirname,
                          "index.html"
                      )
                    : path.join(
                          __dirname,
                          requestedPath
                      );

            filePath =
                path.normalize(
                    filePath
                );

            if (
                !filePath.startsWith(
                    __dirname
                )
            ) {
                res.writeHead(403);
                res.end("Forbidden");
                return;
            }

            fs.readFile(
                filePath,
                (err, data) => {
                    if (err) {
                        res.writeHead(
                            404
                        );

                        res.end(
                            "Not found"
                        );

                        return;
                    }

                    const types = {
                        ".html":
                            "text/html",
                        ".js":
                            "text/javascript",
                        ".css":
                            "text/css",
                        ".png":
                            "image/png",
                        ".jpg":
                            "image/jpeg",
                        ".jpeg":
                            "image/jpeg"
                    };

                    res.writeHead(
                        200,
                        {
                            "Content-Type":
                                types[
                                    path.extname(
                                        filePath
                                    )
                                ] ||
                                "application/octet-stream"
                        }
                    );

                    res.end(data);
                }
            );
        }
    );

const wss =
    new WebSocket.Server({
        server
    });

wss.on(
    "connection",
    (socket, request) => {
        const url =
            new URL(
                request.url,
                `http://${request.headers.host}`
            );

        const playerId =
            url.searchParams.get(
                "playerId"
            );

        if (
            !playerId ||
            playerId.length > 100
        ) {
            socket.close();
            return;
        }

        const oldConnection =
            players.get(playerId);

        if (oldConnection) {
            oldConnection.socket.close();
            players.delete(playerId);
        }

        const existingPlayer =
            savedPlayers[playerId];

        let player;

        if (existingPlayer) {
            player = {
                id:
                    Number(
                        existingPlayer.id
                    ),
                playerId,
                x:
                    Number(
                        existingPlayer.x
                    ),
                y:
                    Number(
                        existingPlayer.y
                    ),
                radius:
                    Math.max(
                        20,
                        Number(
                            existingPlayer.radius
                        )
                    ),
                foodCount:
                    Math.max(
                        0,
                        Number(
                            existingPlayer.foodCount
                        )
                    ),
                nickname:
                    typeof existingPlayer.nickname ===
                        "string" &&
                    existingPlayer.nickname
                        .length > 0
                        ? existingPlayer.nickname
                        : `Player_${existingPlayer.id}`,
                socket
            };
        } else {
            const id =
                nextId++;

            player = {
                id,
                playerId,
                x: 1000,
                y: 1000,
                radius: 20,
                foodCount: 0,
                nickname:
                    `Player_${id}`,
                socket
            };
        }

        players.set(
            playerId,
            player
        );

        const onlinePlayers = {};

        for (
            const currentPlayer
            of players.values()
        ) {
            onlinePlayers[
                currentPlayer.id
            ] = {
                x:
                    currentPlayer.x,
                y:
                    currentPlayer.y,
                radius:
                    currentPlayer.radius,
                foodCount:
                    currentPlayer.foodCount,
                nickname:
                    currentPlayer.nickname
            };
        }

        socket.send(
            JSON.stringify({
                type: "init",
                id: player.id,
                food: {
                    x: food.x,
                    y: food.y,
                    radius:
                        food.radius
                },
                players:
                    onlinePlayers
            })
        );

        broadcast(
            {
                type: "join",
                id: player.id,
                x: player.x,
                y: player.y,
                radius:
                    player.radius,
                foodCount:
                    player.foodCount,
                nickname:
                    player.nickname
            },
            player.id
        );

        savePlayers();

        socket.on(
            "message",
            message => {
                try {
                    const data =
                        JSON.parse(
                            message
                        );

                    const currentPlayer =
                        players.get(
                            playerId
                        );

                    if (
                        !currentPlayer ||
                        currentPlayer.socket !==
                            socket
                    ) {
                        return;
                    }

                    if (
                        data.type ===
                        "move"
                    ) {
                        const newX =
                            Number(
                                data.x
                            );

                        const newY =
                            Number(
                                data.y
                            );

                        const newRadius =
                            Number(
                                data.radius
                            );

                        if (
                            !Number.isFinite(
                                newX
                            ) ||
                            !Number.isFinite(
                                newY
                            ) ||
                            !Number.isFinite(
                                newRadius
                            )
                        ) {
                            return;
                        }

                        currentPlayer.radius =
                            Math.max(
                                20,
                                newRadius
                            );

                        currentPlayer.x =
                            Math.max(
                                currentPlayer.radius,
                                Math.min(
                                    world.width -
                                        currentPlayer.radius,
                                    newX
                                )
                            );

                        currentPlayer.y =
                            Math.max(
                                currentPlayer.radius,
                                Math.min(
                                    world.height -
                                        currentPlayer.radius,
                                    newY
                                )
                            );

                        savedPlayers[
                            playerId
                        ] = {
                            id:
                                currentPlayer.id,
                            playerId,
                            x:
                                currentPlayer.x,
                            y:
                                currentPlayer.y,
                            radius:
                                currentPlayer.radius,
                            foodCount:
                                currentPlayer.foodCount,
                            nickname:
                                currentPlayer.nickname
                        };

                        broadcast({
                            type: "move",
                            id:
                                currentPlayer.id,
                            x:
                                currentPlayer.x,
                            y:
                                currentPlayer.y,
                            radius:
                                currentPlayer.radius,
                            foodCount:
                                currentPlayer.foodCount,
                            nickname:
                                currentPlayer.nickname
                        });
                    }

                    if (
                        data.type ===
                        "eatFood"
                    ) {
                        const distance =
                            Math.hypot(
                                currentPlayer.x -
                                    food.x,
                                currentPlayer.y -
                                    food.y
                            );

                        if (
                            distance <=
                            currentPlayer.radius +
                                food.radius +
                                8
                        ) {
                            currentPlayer.radius +=
                                1;

                            currentPlayer.foodCount +=
                                1;

                            food.x =
                                food.radius +
                                Math.random() *
                                    (
                                        world.width -
                                        food.radius *
                                            2
                                    );

                            food.y =
                                food.radius +
                                Math.random() *
                                    (
                                        world.height -
                                        food.radius *
                                            2
                                    );

                            savedPlayers[
                                playerId
                            ] = {
                                id:
                                    currentPlayer.id,
                                playerId,
                                x:
                                    currentPlayer.x,
                                y:
                                    currentPlayer.y,
                                radius:
                                    currentPlayer.radius,
                                foodCount:
                                    currentPlayer.foodCount,
                                nickname:
                                    currentPlayer.nickname
                            };

                            savePlayers();

                            broadcast({
                                type:
                                    "foodEaten",
                                food: {
                                    x:
                                        food.x,
                                    y:
                                        food.y,
                                    radius:
                                        food.radius
                                },
                                playerId:
                                    currentPlayer.id,
                                radius:
                                    currentPlayer.radius,
                                foodCount:
                                    currentPlayer.foodCount
                            });
                        }
                    }

                    if (
                        data.type ===
                        "emote"
                    ) {
                        const allowed = [
                            "😂",
                            "😡",
                            "😞"
                        ];

                        if (
                            !allowed.includes(
                                data.emoji
                            )
                        ) {
                            return;
                        }

                        broadcast({
                            type:
                                "emote",
                            playerId:
                                currentPlayer.id,
                            nickname:
                                currentPlayer.nickname,
                            emoji:
                                data.emoji
                        });
                    }
                } catch (error) {
                    console.error(
                        error
                    );
                }
            }
        );

        socket.on(
            "close",
            () => {
                const currentPlayer =
                    players.get(
                        playerId
                    );

                if (
                    !currentPlayer ||
                    currentPlayer.socket !==
                        socket
                ) {
                    return;
                }

                savedPlayers[
                    playerId
                ] = {
                    id:
                        currentPlayer.id,
                    playerId,
                    x:
                        currentPlayer.x,
                    y:
                        currentPlayer.y,
                    radius:
                        currentPlayer.radius,
                    foodCount:
                        currentPlayer.foodCount,
                    nickname:
                        currentPlayer.nickname
                };

                players.delete(
                    playerId
                );

                savePlayers();

                broadcast({
                    type: "leave",
                    id:
                        currentPlayer.id
                });
            }
        );
    }
);

function broadcast(
    data,
    exceptId = null
) {
    const message =
        JSON.stringify(data);

    for (
        const player
        of players.values()
    ) {
        if (
            player.id === exceptId
        ) {
            continue;
        }

        if (
            player.socket.readyState ===
            WebSocket.OPEN
        ) {
            player.socket.send(
                message
            );
        }
    }
}

setInterval(
    savePlayers,
    10000
);

process.on(
    "SIGINT",
    () => {
        savePlayers();
        process.exit(0);
    }
);

process.on(
    "SIGTERM",
    () => {
        savePlayers();
        process.exit(0);
    }
);

server.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `Game running on port ${PORT}`
        );
    }
);
