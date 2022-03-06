const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const FPS = 60;
const SHIP_SIZE = 30;
const TURN_SPEED = 360; // degrees per second
const SHIP_THRUST = 5; // acc in ppsps
const ROIDS_NUM = 1; // Number of asteroids per round
const ROIDS_JAG = 0.3; // jaggedness of the asteroids (0 = none, 1 = lots)
const ROIDS_SPEED = 50; // max starting speed
const ROIDS_SIZE = 100; // max starting size
const ROIDS_VERT = 10; // Average number of verticies on each asteroid
const ROIDS_PTS_LRG = 20; // Points scored for large asteroids
const ROIDS_PTS_MED = 50; // Points scored for medium asteroids
const ROIDS_PTS_SML = 100; // Points scored for small asteroids
const FRICTION = 0.7; // 0 is no friction, 1 is lots of friction
const SHIP_EXPLODE_DUR = 0.3; // Duration of explosion
const SHIP_BLINK_DUR = 0.1; // Duration of bliink during invince
const SHIP_INV_DUR = 3; // Duration of invincibility after explosion
const LASER_MAX = 10; // Max number of lasers on screen at once
const LASER_SPEED = 500; // speed of lasers
const LASER_DIST = 0.6; // Max distance lasers can travel as fraction of screen width
const LASER_EXPLODE_DUR = 0.1; // Duration of laser explosion
const TEXT_SIZE = 35; // Text font size in pixels
const TEXT_FADE_TIME = 2.5; // Text font size in pixels
const GAME_LIVES = 3; // Starting number of lives
const SAVE_KEY_SCORE = "asteroidsGameHigh"; // Save key for local highscore storage

// Developer Flags
const MUSIC_ON = true; // Music on / off
const SOUND_ON = true; // sound fx on / off
const showCentreDot = false; // Show/hide ship centre dot
const SHOW_BOUNDING = false; // Show/hide collision bounding

// Set up sound effect
//let fxLaser = new Audio("sounds/laser.m4a");
let fxLaser = new Sound("sounds/laser.m4a", 5, 0.5);
let fxExplode = new Sound("sounds/explode.m4a");
let fxHit = new Sound("sounds/hit.m4a", 5);
let fxThrust = new Sound("sounds/thrust.m4a");

// Set up music
let music;
let roidsLeft, roidsTotal;

let exploding;
let blinkOn;

// Set up game parameters
let ship, roids, level, text, textAlpha, lives, score, scoreHigh;
newGame();

function newShip() {
    return {
        x: canvas.width / 2,
        y: canvas.height / 2,
        r: SHIP_SIZE / 2,
        a: (90 / 180) * Math.PI, // Convert to radians
        rot: 0,
        thrusting: false,
        thrust: {
            x: 0,
            y: 0
        },
        explodeTime: 0,
        dead: false,
        canShoot: true,
        lasers: [],
        blinkTime: Math.ceil(SHIP_BLINK_DUR * FPS),
        blinkNum: Math.ceil(SHIP_INV_DUR / SHIP_BLINK_DUR)
    };
}

function newGame() {
    // reset level && lives
    lives = GAME_LIVES;
    level = 0;
    score = 0;
    scoreHigh = localStorage.getItem(SAVE_KEY_SCORE) == null ? 0 : localStorage.getItem(SAVE_KEY_SCORE);
    
    // Player
    ship = newShip();
    
    // New level
    newLevel();
    
    // Reset music
    music = new Music("sounds/music-low.m4a", "sounds/music-high.m4a");
}

function gameOver() {
    ship.dead = true;
    text = "Game Over";
    textAlpha = 1.0;
}

function newLevel() {
    text = "Level " + (level + 1);
    textAlpha = 1.0;
    
    // Setting up the asteroids
    createAsteroidBelt();
}

// Event handlers
function keyDown(event) {
    // Dead
    if (ship.dead) {
        return;
    }
    
    switch(event.keyCode) {
        case 32: // space bar (shoot alser)
            shootLaser();
            break;
        case 37: // left arrow (rotate left)
            ship.rot = TURN_SPEED / 180 * Math.PI / FPS;
            break;
        case 38: // Up arrow (move forward)
            ship.thrusting = true;
            break;
        case 39: // right arrow (rotate right)
            ship.rot = - TURN_SPEED / 180 * Math.PI / FPS;
            break;
    }
}

function keyUp(event) {
    // Dead
    if (ship.dead) {
        return;
    }
    
    switch(event.keyCode) {
        case 32: // space bar (allow shooting again)
            ship.canShoot = true;
            break;
        case 37: // left arrow (stop rotation)
            ship.rot = 0;
            break;
        case 38: // Up arrow (stop moving forward)
            ship.thrusting = false;
            break;
        case 39: // right arrow (stop rotation)
            ship.rot = 0;
            break;
    }
}

function shootLaser() {
    // ------------------------------------------------------- Create laser
    if (ship.canShoot && ship.lasers.length < LASER_MAX && !exploding) {
        ship.lasers.push({
            x: ship.x + 4 / 3 * ship.r * Math.cos(ship.a),
            y: ship.y - 4 / 3 * ship.r * Math.sin(ship.a),
            xv: LASER_SPEED * Math.cos(ship.a) / FPS,
            yv: LASER_SPEED * Math.sin(ship.a) / FPS,
            dist: 0,
            explodeTime: 0
        });
        fxLaser.play();
    }
    
    // ------------------------------------------------------- Prevent further lasers
    ship.canShoot = false;
}

function createAsteroidBelt() {
    roids = [];
    roidsTotal = (ROIDS_NUM + level) * 7;
    roidsLeft = roidsTotal;
    let x, y, r;
    for (let i = 0; i < ROIDS_NUM + level; i++) {
        do {
            x = Math.floor(Math.random() * canvas.width);
            y = Math.floor(Math.random() * canvas.height);
        } while (distBetweenPoints(ship.x, ship.y, x, y) < ROIDS_SIZE * 2 + ship.r)
        roids.push(newAsteroid(x, y, ROIDS_SIZE / 2));
    }
}

function distBetweenPoints(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function newAsteroid(x, y, r) {
    // Level multiplier for asteroid speed
    let lvlMult = 1 + 0.1 * level;
    
    let roid = {
        x: x,
        y: y,
        xv: Math.random() * ROIDS_SPEED * lvlMult / FPS * (Math.random() < 0.5 ? 1 : -1),
        yv: Math.random() * ROIDS_SPEED * lvlMult / FPS * (Math.random() < 0.5 ? 1 : -1),
        r: r,
        a: Math.random() * Math.PI * 2,
        vert: Math.floor(Math.random() * (ROIDS_VERT + 1) + ROIDS_VERT / 2),
        offs: []
    }
    
    // Create vertex offset array
    for (let i = 0; i < roid.vert; i++) {
        roid.offs.push(Math.random() * ROIDS_JAG * 2 + 1 - ROIDS_JAG);
    }
    
    return roid;
}

// -------------------------------------------------- Explode ship
function explodeShip() {
    ship.explodeTime = Math.ceil(SHIP_EXPLODE_DUR * FPS);
    fxExplode.play();
}

function destroyAsteroid(index) {
    let x = roids[index].x;
    let y = roids[index].y;
    let r = roids[index].r;
    
    // Split asteroid in 2 if necessary
    if (r == ROIDS_SIZE / 2) {
        roids.push(newAsteroid(x, y, Math.ceil(ROIDS_SIZE / 4)));
        roids.push(newAsteroid(x, y, Math.ceil(ROIDS_SIZE / 4)));
        score += ROIDS_PTS_LRG;
    } else if (r == Math.ceil(ROIDS_SIZE / 4)) {
        roids.push(newAsteroid(x, y, Math.ceil(ROIDS_SIZE / 8)));
        roids.push(newAsteroid(x, y, Math.ceil(ROIDS_SIZE / 8)));
        score += ROIDS_PTS_MED;
    } else {
        score += ROIDS_PTS_SML;
    }
    
    if (score > scoreHigh) {
        scoreHigh = score;
        localStorage.setItem(SAVE_KEY_SCORE, scoreHigh);
    }
    
    // Destroy asteroid
    roids.splice(index, 1);
    fxHit.play();
    
    // Calc ratio of remaining asteroids to determine music tempo
    roidsLeft--;
    music.setAsteroidRatio(roidsLeft == 0 ? 1 : roidsLeft / roidsTotal);
    
    // Check for new level
    if (roids.length == 0) {
        level++;
        newLevel();
    }
}

function drawShip(x, y, a, colour = "white") {
    // -------------------------------------------------- Draw triangular ship
    ctx.strokeStyle = colour;
    ctx.lineWidth = SHIP_SIZE / 20;
    ctx.beginPath();
    // Nose of the ship
    ctx.moveTo(
        x + 4 / 3 * ship.r * Math.cos(a),
        y - 4 / 3 * ship.r * Math.sin(a)
    );
    // Back left
    ctx.lineTo(
        x - ship.r * (2 / 3 * Math.cos(a) + Math.sin(a)),
        y + ship.r * (2 / 3 * Math.sin(a) - Math.cos(a))
    )
    //Back right
    ctx.lineTo(
        x - ship.r * (2 / 3 * Math.cos(a) - Math.sin(a)),
        y + ship.r * (2 / 3 * Math.sin(a) + Math.cos(a))
    )
    // Nose
    ctx.lineTo(
        x + 4 / 3 * ship.r * Math.cos(a),
        y - 4 / 3 * ship.r * Math.sin(a)
    )
    ctx.closePath();
    ctx.stroke();
}

function Sound(src, maxStreams = 1, vol = 1.0) {
    this.streamNum = 0;
    this.streams = [];
    for (let i = 0; i < maxStreams; i++) {
        this.streams.push(new Audio(src));
        this.streams[i].volume = vol;
    }
    
    this.play = function () {
        if (SOUND_ON) {
            this.streamNum = (this.streamNum + 1) % maxStreams;
            this.streams[this.streamNum].play();
        }
    }
    
    this.stop = function () {
        this.streams[this.streamNum].pause();
        this.streams[this.streamNum].currentTime = 0;
    }
}

function Music(srcLow, srcHigh) {
    this.soundLow = new Audio(srcLow);
    this.soundHigh = new Audio(srcHigh);
    this.low = true;
    this.tempo = 1.0; // second per beat
    this.beatTime = 0; // frames left till next beat
    
    this.play = function () {
        if (MUSIC_ON) {
            if (this.low) {
                this.soundLow.play();
            } else {
                this.soundHigh.play();
            }
            this.low = !this.low;
        }
    }
    
    this.tick = function () {
        if (this.beatTime == 0) {
            this.play();
            this.beatTime = Math.ceil(this.tempo * FPS / 2);
        } else {
            this.beatTime--;
        }
    }
    
    this.setAsteroidRatio = function(ratio) {
        this.tempo = 1.0 - 0.75 * (1.0 - ratio);
    }
}

document.addEventListener("keydown", keyDown);
document.addEventListener("keyup", keyUp);

setInterval(update, 1000 / FPS);

function update() {
    blinkOn = ship.blinkNum % 2 === 0;
    exploding = ship.explodeTime > 0;
    
    // Tick the music
    music.tick();
    
    // Draw background
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // thrusting the ship
    if (ship.thrusting && !ship.dead) {
        ship.thrust.x += SHIP_THRUST * Math.cos(ship.a) / FPS;
        ship.thrust.y -= SHIP_THRUST * Math.sin(ship.a) / FPS;
        fxThrust.play();
        
        if (!exploding && blinkOn) {
            // ----------------------------------------------- Draw thrusters
            ctx.strokeStyle = "yellow";
            ctx.fillStyle = "red";
            ctx.lineWidth = SHIP_SIZE / 10;
            ctx.beginPath();
            // Rear left
            ctx.moveTo(
                ship.x - ship.r * (2 / 3 * Math.cos(ship.a) + 0.5 * Math.sin(ship.a)),
                ship.y + ship.r * (2 / 3 * Math.sin(ship.a) - 0.5 * Math.cos(ship.a))
            );
            // Rear centre behind the ship
            ctx.lineTo(
                ship.x - ship.r * (5 / 3 * Math.cos(ship.a)),
                ship.y + ship.r * (5 / 3 * Math.sin(ship.a))
            );
            // Rear right
            ctx.lineTo(
                ship.x - ship.r * (2 / 3 * Math.cos(ship.a) - 0.5 * Math.sin(ship.a)),
                ship.y + ship.r * (2 / 3 * Math.sin(ship.a) + 0.5 * Math.cos(ship.a))
            );
            // Nose
            ctx.lineTo(
                ship.x - ship.r * (2 / 3 * Math.cos(ship.a) + 0.5 * Math.sin(ship.a)),
                ship.y + ship.r * (2 / 3 * Math.sin(ship.a) - 0.5 * Math.cos(ship.a))
            );
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
        }
    } else {
        ship.thrust.x -= FRICTION * ship.thrust.x / FPS;
        ship.thrust.y -= FRICTION * ship.thrust.y / FPS;
        fxThrust.stop();
    }
    
    // Handle edge of screen
    if (ship.x < 0 - ship.r) {
        ship.x = canvas.width + ship.r;
    } else if (ship.x > canvas.width + ship.r) {
        ship.x = 0 - ship.r;
    }
    if (ship.y < 0 - ship.r) {
        ship.y = canvas.height + ship.r;
    } else if (ship.y > canvas.height + ship.r) {
        ship.y = 0 - ship.r;
    }
        
    // draw asteroids
    let x, y, r, a, vert, offs;
    for (let i = 0; i < roids.length; i++) {
        // Moving asteroids
        roids[i].x += roids[i].xv;
        roids[i].y += roids[i].yv;
        
        // Handle edge of screen
        if (roids[i].x < 0 - roids[i].r) {
            roids[i].x = canvas.width + roids[i].r;
        } else if (roids[i].x > canvas.width + roids[i].r) {
            roids[i].x = 0 - roids[i].r;
        }
        if (roids[i].y < 0 - roids[i].r) {
            roids[i].y = canvas.height + roids[i].r;
        } else if (roids[i].y > canvas.height + roids[i].r) {
            roids[i].y = 0 - roids[i].r;
        }
        
        // Get asteroid properties;
        x = roids[i].x;
        y = roids[i].y;
        r = roids[i].r;
        a = roids[i].a;
        vert = roids[i].vert;
        offs = roids[i].offs;
        
        ctx.strokeStyle = "slategrey";
        ctx.lineWidth = ROIDS_SIZE / 20;
        ctx.beginPath();
        ctx.moveTo(
            x + r * offs[0] * Math.cos(a),
            y + r * offs[0] * Math.sin(a)
        );
        
        for (let j = 1; j < vert; j++) {
            ctx.lineTo(
                x + r * offs[j] * Math.cos(a + j * Math.PI * 2 / vert),
                y + r * offs[j] * Math.sin(a + j * Math.PI * 2 / vert)
            );
        }
        ctx.closePath();
        ctx.stroke();
        
        if (SHOW_BOUNDING) {
            ctx.strokeStyle = "lime";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2, false);
            ctx.closePath();
            ctx.stroke();
        }
    }
    
    if (!exploding) {
        // Rotate ship
        ship.a += ship.rot;

        // Move ship
        ship.x += ship.thrust.x;
        ship.y += ship.thrust.y;
    } else {
        ship.explodeTime--;
        
        if (ship.explodeTime == 0) {
            lives--;
            if (lives == 0) {
                gameOver();
            } else {
                ship = newShip();
            }
        }
    }
    
    if (!exploding) {
        if (blinkOn && !ship.dead) {
            drawShip(ship.x, ship.y, ship.a);
        }
        
        if (ship.blinkNum > 0) {
            // Reduce blink time
            ship.blinkTime--;
            
            // Reduce blink num
            if (ship.blinkTime === 0) {
                ship.blinkTime = Math.ceil(SHIP_BLINK_DUR * FPS);
                ship.blinkNum--;
            }
        }
            
        
    } else {
        // --------------------------------------------- draw explosions
        ctx.fillStyle = "darkred";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.r * 1.7, 0, Math.PI * 2, false);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "red";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.r * 1.4, 0, Math.PI * 2, false);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "orange";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.r * 1.1, 0, Math.PI * 2, false);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "yellow";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.r * 0.8, 0, Math.PI * 2, false);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.r * 0.5, 0, Math.PI * 2, false);
        ctx.closePath();
        ctx.fill();
    }
    
    // --------------------------- Collision bounds
    if (SHOW_BOUNDING) {
        ctx.strokeStyle = "lime";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, ship.r, 0, Math.PI * 2, false);
        ctx.closePath();
        ctx.stroke();
    }
    
    if (!exploding && !ship.dead) {
        if (ship.blinkNum === 0) {
            for (let i = 0; i < roids.length; i++) {
                if (distBetweenPoints(ship.x, ship.y, roids[i].x, roids[i].y) < ship.r + roids[i].r) {
                    explodeShip();
                    destroyAsteroid(i);
                    break;
                }
            }
        }
    }
    
    // ------------------------------------------------------ Drawing and moving lasers
    for (let i = 0; i < ship.lasers.length; i++) {
        // Check dist travelled
        if (ship.lasers[i].dist > LASER_DIST * canvas.width) {
            ship.lasers.splice(i, 1);
            continue;
        }
        
        if (ship.lasers[i].explodeTime > 0) {
            ship.lasers[i].explodeTime--;
            if (ship.lasers[i].explodeTime == 0) {
                ship.lasers.splice(i, 1);
                continue;
            }
        } else {
            // Move lasers
            ship.lasers[i].x += ship.lasers[i].xv;
            ship.lasers[i].y -= ship.lasers[i].yv;

            ship.lasers[i].dist += Math.sqrt(Math.pow(ship.lasers[i].xv, 2) + Math.pow(ship.lasers[i].yv, 2));
        }
        
        // Handle edge of screen
        if (ship.lasers[i].x < 0) {
            ship.lasers[i].x = canvas.width;
        } else if (ship.lasers[i].x > canvas.width) {
            ship.lasers[i].x = 0;
        }
        if (ship.lasers[i].y < 0) {
            ship.lasers[i].y = canvas.height;
        } else if (ship.lasers[i].y > canvas.height) {
            ship.lasers[i].y = 0;
        }
        
        // Draw lasers
        if (ship.lasers[i].explodeTime === 0) {
            ctx.fillStyle = "salmon";
            ctx.beginPath();
            ctx.arc(ship.lasers[i].x, ship.lasers[i].y, SHIP_SIZE / 15, 0, Math.PI * 2, false);
            ctx.closePath();
            ctx.fill();
        } else {
            // Draw laser explosions
            ctx.fillStyle = "orangered";
            ctx.beginPath();
            ctx.arc(ship.lasers[i].x, ship.lasers[i].y, ship.r * 0.75, 0, Math.PI * 2, false);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "salmon";
            ctx.beginPath();
            ctx.arc(ship.lasers[i].x, ship.lasers[i].y, ship.r * 0.5, 0, Math.PI * 2, false);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "pink";
            ctx.beginPath();
            ctx.arc(ship.lasers[i].x, ship.lasers[i].y, ship.r * 0.25, 0, Math.PI * 2, false);
            ctx.closePath();
            ctx.fill();
        }
    }
    
    // Detect laser hits on asteroid
    let ax, ay, ar, lx, ly;
    for (let i = roids.length - 1; i >= 0; i--) {
        // Asteroid properties
        ax = roids[i].x;
        ay = roids[i].y;
        ar = roids[i].r;
        
        // Loop over the lasers
        for (let j = ship.lasers.length - 1; j >= 0; j--) {
            // get laser properties
            lx = ship.lasers[j].x;
            ly = ship.lasers[j].y;
            
            // Collisions
            if (ship.lasers[j].explodeTime == 0 && distBetweenPoints(ax, ay, lx, ly) < ar) {
                // Remove asteroid
                destroyAsteroid(i);
                
                // Activate laser explosion
                ship.lasers[j].explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);
            }
        }
    }
    
    // Draw game text
    if (textAlpha > 0) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255, 255, 255, " + textAlpha + ")";
        ctx.font = "small-caps " + TEXT_SIZE + "px dejavu sans mono";
        ctx.fillText(text, canvas.width / 2, canvas.height * 0.75);
        textAlpha -= (1.0 / TEXT_FADE_TIME / FPS);
    } else if (ship.dead) {
        newGame();
    }
    
    // Draw lives
    let lifeColour;
    for (let i = 0; i < lives; i++) {
        lifeColour = exploding && i == lives - 1 ? "red" : "white";
        drawShip(SHIP_SIZE + i * SHIP_SIZE * 1.2, SHIP_SIZE, 0.5 * Math.PI, lifeColour);
    }
    
    // Draw score
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "white";
    ctx.font = "small-caps " + TEXT_SIZE + "px dejavu sans mono";
    ctx.fillText(`Score: ${score}`, canvas.width - SHIP_SIZE / 2, SHIP_SIZE);
    
    // highscore
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "white";
    ctx.font = "small-caps " + (TEXT_SIZE * 0.75) + "px dejavu sans mono";
    ctx.fillText(`High: ${scoreHigh}`, canvas.width / 2, SHIP_SIZE);
    
    if (showCentreDot) {
        // Centre dot
        ctx.fillStyle = "red";
        ctx.fillRect(ship.x - 1, ship.y - 1, 2, 2);
    }
}