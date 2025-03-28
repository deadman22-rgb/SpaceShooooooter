// script.js

// ==================================
// CONFIGURATION (Keep player radius at 15 for now)
// ==================================
const Config = {
    player: { width: 30, height: 20, color: '#0ff', glowColor: '#0ff', glowBlur: 15, speed: 4, rotationSpeed: 0.1, collisionRadius: 15, baseCooldown: 150 },
    obstacle: { minSize: 20, maxSize: 50, color: '#f0f', glowColor: '#f0f', glowBlur: 10, minSpeed: 1, maxSpeed: 3, spawnRate: 45, lifespanFrames: 400, despawnRadius: 15 },
    bullet: { radius: 4, color: '#ff0', glowColor: '#ff0', glowBlur: 8, speed: 7, cooldown: 150 },
    particle: { count: 15, minSize: 1, maxSize: 4, minSpeed: 1, maxSpeed: 4, minLifespan: 20, maxLifespan: 50, glowBlur: 5 },
    ui: { color: '#0f0', glowColor: '#0f0', glowBlur: 8, font: '20px "Consolas", "Courier New", monospace' },
    canvasClearAlpha: 0.25,
    powerup: {
        spawnChance: 0.15, lifespanFrames: 500, radius: 10, glowBlur: 12,
        types: [
            { id: 'shield', color: '#00f', glowColor: '#55f', duration: 5*60, applyEffect: (g)=>{if(g.player)g.player.isShieldActive=true;console.log("Shield On");}, removeEffect:(g)=>{if(g.player)g.player.isShieldActive=false;console.log("Shield Off");} },
            { id: 'rapidFire', color: '#f90', glowColor: '#fc8', duration: 7*60, applyEffect:(g)=>{Config.bullet.cooldown=Math.max(50,Config.player.baseCooldown/3);console.log("Rapid On");}, removeEffect:(g)=>{Config.bullet.cooldown=Config.player.baseCooldown;console.log("Rapid Off");} }
        ]
    },
    joystick: { radius: 50, deadzone: 0.15 }
};
Config.player.baseCooldown = Config.bullet.cooldown;

// ==================================
// UTILITIES
// ==================================
const Utils = { getRandom(min,max){return Math.random()*(max-min)+min;}, getDistanceSq(x1,y1,x2,y2){const dx=x1-x2;const dy=y1-y2;return dx*dx+dy*dy;}};

// ==================================
// INPUT MANAGER (Robust Joystick Init)
// ==================================
const InputManager = {
    // ... (Properties remain the same) ...
    keysPressed: {}, mousePos: { x: 0, y: 0 }, isMouseDown: false,
    joystickVector: { x: 0, y: 0 }, joystickActive: false, joystickTouchId: null,
    isTouchDevice: false,
    canvas: null, joystickAreaElement: null, joystickBaseElement: null, joystickHandleElement: null,
    joystickAreaRect: null, joystickCenterX: 0, joystickCenterY: 0,
    _joystickInitAttempts: 0, // Counter for joystick init attempts


    init(canvas) {
        this.canvas = canvas;
        this.mousePos = { x: canvas.width / 2, y: canvas.height / 2 };
        try {
            this.isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || document.documentElement.ontouchstart !== undefined;
            console.log(`InputManager: Touch detection complete. Is Touch Device: ${this.isTouchDevice}`);
        } catch (error) { console.error("InputManager: Error during touch detection", error); this.isTouchDevice = false; }

        // --- Keyboard Listeners ---
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
        console.log("InputManager: Keyboard listeners attached.");

        if (this.isTouchDevice) {
            console.log("InputManager: Setting up Touch Input...");
            // --- Touch / Joystick Setup ---
            this.joystickAreaElement = document.getElementById('joystick-area');
            this.joystickBaseElement = document.getElementById('joystick-base');
            this.joystickHandleElement = document.getElementById('joystick-handle');

            if (this.joystickAreaElement && this.joystickBaseElement && this.joystickHandleElement) {
                this.joystickAreaElement.style.display = 'flex'; // Make it visible NOW
                console.log("InputManager: Joystick element display set to flex.");

                // **Attempt to calculate center immediately, then retry if needed**
                this.attemptJoystickCenterCalculation(); // Start the process

                // Attach touch listeners regardless of immediate calculation success
                window.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
                window.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
                window.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
                window.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });
                console.log("InputManager: Touch listeners attached.");

                document.body.addEventListener('touchmove', (e) => { if (this.joystickActive) { e.preventDefault(); } }, { passive: false });
                this.canvas.addEventListener('touchstart', (e) => { const touch = e.touches[0]; if (touch && !this.isTouchInJoystickArea(touch)) { e.preventDefault(); } }, { passive: false });

            } else { console.error("InputManager: Joystick HTML elements not found!"); }

        } else {
             console.log("InputManager: Setting up Mouse Input...");
            // --- Mouse Setup ---
            this.canvas.style.cursor = 'crosshair';
            window.addEventListener('mousemove', this.handleMouseMove.bind(this));
            window.addEventListener('mousedown', this.handleMouseDown.bind(this));
            window.addEventListener('mouseup', this.handleMouseUp.bind(this));
            this.canvas.addEventListener('contextmenu', e => e.preventDefault());
            console.log("InputManager: Mouse listeners attached.");
        }
         console.log("InputManager: Init sequence complete.");
    },

    // New function to attempt calculation and retry
    attemptJoystickCenterCalculation() {
        console.log(`InputManager: Attempting joystick center calculation (Attempt ${this._joystickInitAttempts + 1})...`);
        if (!this.joystickAreaElement || !this.isTouchDevice) {
            console.warn("InputManager: Cannot calculate joystick center - element missing or not touch device.");
            return;
        }

        const rect = this.joystickAreaElement.getBoundingClientRect();
        console.log("InputManager: getBoundingClientRect result:", rect); // Log the raw rect

        if (rect && rect.width > 0 && rect.height > 0) {
            // Success! Calculate and store
            this.joystickAreaRect = rect;
            this.joystickCenterX = this.joystickAreaRect.left + this.joystickAreaRect.width / 2;
            this.joystickCenterY = this.joystickAreaRect.top + this.joystickAreaRect.height / 2;
            console.log(`InputManager: Joystick Center Calculation SUCCESS: X=${this.joystickCenterX.toFixed(1)}, Y=${this.joystickCenterY.toFixed(1)}`);
            this._joystickInitAttempts = 0; // Reset counter on success
        } else {
            // Failure - Retry after a short delay
            this._joystickInitAttempts++;
            if (this._joystickInitAttempts < 10) { // Limit retries
                console.warn(`InputManager: Joystick area dimensions invalid (W:${rect?.width}, H:${rect?.height}). Retrying calculation shortly...`);
                setTimeout(() => this.attemptJoystickCenterCalculation(), 100); // Retry after 100ms
            } else {
                console.error("InputManager: Failed to calculate joystick center after multiple attempts. Joystick may not function correctly.");
                 // Optionally use fallback calculation here if desperate
            }
        }
    },

    calculateJoystickCenter(){ /* Keep this for direct calls if needed, but prefer attemptJoystickCenterCalculation */ if(!this.joystickAreaElement||!this.isTouchDevice)return; this.joystickAreaRect=this.joystickAreaElement.getBoundingClientRect(); if(!this.joystickAreaRect||this.joystickAreaRect.width===0||this.joystickAreaRect.height===0){console.error("Direct calculateJoystickCenter failed!"); return;} this.joystickCenterX=this.joystickAreaRect.left+this.joystickAreaRect.width/2;this.joystickCenterY=this.joystickAreaRect.top+this.joystickAreaRect.height/2; console.log("Direct calculateJoystickCenter success:", this.joystickCenterX, this.joystickCenterY);},


    // ... (Rest of InputManager remains mostly the same, ensure logs are still present if needed) ...
    handleKeyDown(e){this.keysPressed[e.code]=true;if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space","KeyW","KeyA","KeyS","KeyD"].includes(e.code)){e.preventDefault();}if(!this.isTouchDevice&&e.code==='Space'&&Game.state&&!Game.state.isGameOver){if(Game.player)Game.player.tryShoot();}if(Game.state&&Game.state.isGameOver&&e.code==='KeyR'){Game.restart();}},
    handleKeyUp(e){this.keysPressed[e.code]=false;},
    handleMouseMove(e){if(this.isTouchDevice)return;const rect=this.canvas.getBoundingClientRect();this.mousePos.x=e.clientX-rect.left;this.mousePos.y=e.clientY-rect.top;},
    handleMouseDown(e){if(this.isTouchDevice)return;if(e.button===0&&Game.state&&!Game.state.isGameOver){this.isMouseDown=true;if(Game.player)Game.player.tryShoot();}},
    handleMouseUp(e){if(this.isTouchDevice)return;if(e.button===0){this.isMouseDown=false;}},
    handleTouchStart(e){if(!this.isTouchDevice)return;for(let i=0;i<e.changedTouches.length;i++){const touch=e.changedTouches[i];if(!this.joystickActive&&this.isTouchInJoystickArea(touch)){e.preventDefault();this.joystickActive=true;this.joystickTouchId=touch.identifier;this.updateJoystick(touch);break;}}},
    handleTouchMove(e){if(!this.isTouchDevice||!this.joystickActive)return;for(let i=0;i<e.changedTouches.length;i++){const touch=e.changedTouches[i];if(touch.identifier===this.joystickTouchId){this.updateJoystick(touch);break;}}},
    handleTouchEnd(e){if(!this.isTouchDevice||!this.joystickActive)return;for(let i=0;i<e.changedTouches.length;i++){const touch=e.changedTouches[i];if(touch.identifier===this.joystickTouchId){this.resetJoystick();break;}}},
    isTouchInJoystickArea(touch){if(!this.joystickAreaRect||!touch)return false;const inArea=(touch.clientX>=this.joystickAreaRect.left&&touch.clientX<=this.joystickAreaRect.right&&touch.clientY>=this.joystickAreaRect.top&&touch.clientY<=this.joystickAreaRect.bottom);return inArea;},
    updateJoystick(touch){if(!this.isTouchDevice||!this.joystickHandleElement||!touch||this.joystickCenterX===0)return;const deltaX=touch.clientX-this.joystickCenterX;const deltaY=touch.clientY-this.joystickCenterY;const distance=Math.sqrt(deltaX*deltaX+deltaY*deltaY);const maxDist=Config.joystick.radius;let clampedX=deltaX,clampedY=deltaY;if(distance>maxDist){clampedX=(deltaX/distance)*maxDist;clampedY=(deltaY/distance)*maxDist;}this.joystickHandleElement.style.transform=`translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;const normalizedDist=Math.min(distance/maxDist,1.0);if(normalizedDist<Config.joystick.deadzone){this.joystickVector={x:0,y:0};}else{const effectiveRange=1.0-Config.joystick.deadzone;const scaledDist=(normalizedDist-Config.joystick.deadzone)/effectiveRange;const angle=Math.atan2(deltaY,deltaX);this.joystickVector={x:Math.cos(angle)*scaledDist,y:Math.sin(angle)*scaledDist};}},
    resetJoystick(){if(!this.isTouchDevice)return;this.joystickActive=false;this.joystickTouchId=null;this.joystickVector={x:0,y:0};if(this.joystickHandleElement){this.joystickHandleElement.style.transform='translate(-50%,-50%)';}},
    getMovementVector(){let moveX=0,moveY=0;if(this.isTouchDevice&&this.joystickActive){moveX=this.joystickVector.x;moveY=this.joystickVector.y;}else{if(this.keysPressed['KeyW']||this.keysPressed['ArrowUp'])moveY=-1;if(this.keysPressed['KeyS']||this.keysPressed['ArrowDown'])moveY=1;if(this.keysPressed['KeyA']||this.keysPressed['ArrowLeft'])moveX=-1;if(this.keysPressed['KeyD']||this.keysPressed['ArrowRight'])moveX=1;const len=Math.sqrt(moveX*moveX+moveY*moveY);if(len>0){moveX/=len;moveY/=len;}}return{x:moveX,y:moveY};},
    isPrimaryFireHeld(){return!this.isTouchDevice&&this.isMouseDown;}
};

// ==================================
// ENTITY CLASSES
// ==================================
class Particle { /* ... No changes ... */ constructor(x,y,c,gc){const sz=Utils.getRandom(Config.particle.minSize,Config.particle.maxSize);const sp=Utils.getRandom(Config.particle.minSpeed,Config.particle.maxSpeed);const an=Utils.getRandom(0,Math.PI*2);this.l=Utils.getRandom(Config.particle.minLifespan,Config.particle.maxLifespan);this.x=x;this.y=y;this.sz=sz;this.vx=Math.cos(an)*sp;this.vy=Math.sin(an)*sp;this.il=this.l;this.c=c;this.gc=gc;}update(){this.x+=this.vx;this.y+=this.vy;this.l--;return this.l>0;}draw(ctx){const lr=Math.max(0,this.l/this.il);ctx.globalAlpha=lr;ctx.shadowBlur=Config.particle.glowBlur*lr;ctx.shadowColor=this.gc;ctx.fillStyle=this.c;ctx.fillRect(this.x-this.sz/2,this.y-this.sz/2,this.sz,this.sz);ctx.globalAlpha=1.0;ctx.shadowBlur=0;ctx.shadowColor='transparent';}}
// **Bullet Class with NaN check**
class Bullet {
    constructor(x, y, angle) {
        // **NaN Check:** Ensure angle is valid before calculating velocity
        if (isNaN(angle)) {
            console.error(`Bullet Constructor: Invalid angle received (NaN). Defaulting to 0.`);
            angle = 0; // Default angle if invalid
        }
        this.x = x;
        this.y = y;
        this.radius = Config.bullet.radius;
        this.speed = Config.bullet.speed; // Store speed if needed later
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;

        // **NaN Check:** Verify velocities are numbers
        if (isNaN(this.vx) || isNaN(this.vy)) {
             console.error(`Bullet Constructor: Calculated velocity is NaN! Angle: ${angle}, Speed: ${this.speed}, vx: ${this.vx}, vy: ${this.vy}`);
             // Set a default velocity to prevent further errors, though object might behave weirdly
             this.vx = this.speed;
             this.vy = 0;
        }
    }
    update(cw,ch){this.x+=this.vx;this.y+=this.vy;return(this.x>-this.radius&&this.x<cw+this.radius&&this.y>-this.radius&&this.y<ch+this.radius);} // No change needed here
    draw(ctx){ctx.shadowBlur=Config.bullet.glowBlur;ctx.shadowColor=Config.bullet.glowColor;ctx.fillStyle=Config.bullet.color;ctx.beginPath();ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.shadowColor='transparent';}
}
class Obstacle { constructor(cw,ch,cx,cy){const e=Math.floor(Utils.getRandom(0,4));this.s=Utils.getRandom(Config.obstacle.minSize,Config.obstacle.maxSize);this.radius=this.s/2;this.l=Config.obstacle.lifespanFrames;this.c=Config.obstacle.color;this.gc=Config.obstacle.glowColor;switch(e){case 0:this.x=Utils.getRandom(0,cw);this.y=-this.radius;break;case 1:this.x=cw+this.radius;this.y=Utils.getRandom(0,ch);break;case 2:this.x=Utils.getRandom(0,cw);this.y=ch+this.radius;break;case 3:this.x=-this.radius;this.y=Utils.getRandom(0,ch);break;}const dx=cx-this.x;const dy=cy-this.y;const d=Math.sqrt(dx*dx+dy*dy)||1;const sp=Utils.getRandom(Config.obstacle.minSpeed,Config.obstacle.maxSpeed);this.vx=(dx/d)*sp;this.vy=(dy/d)*sp;}update(cx,cy){this.x+=this.vx;this.y+=this.vy;this.l--;const dSq=Utils.getDistanceSq(this.x,this.y,cx,cy);const desp=this.l<=0||dSq<Config.obstacle.despawnRadius*Config.obstacle.despawnRadius;return!desp;}draw(ctx){ctx.shadowBlur=Config.obstacle.glowBlur;ctx.shadowColor=this.gc;ctx.fillStyle=this.c;ctx.beginPath();ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.shadowColor='transparent'; /* // DEBUG Radius // ctx.save(); ctx.strokeStyle='rgba(255,0,0,0.5)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(this.x,this.y,this.radius,0,Math.PI*2); ctx.stroke(); ctx.restore(); */ }}
class PowerUp { /* ... No changes ... */ constructor(x,y,typeConfig){this.x=x;this.y=y;this.type=typeConfig.id;this.color=typeConfig.color;this.glowColor=typeConfig.glowColor;this.radius=Config.powerup.radius;this.lifespan=Config.powerup.lifespanFrames;this.bobAngle=Math.random()*Math.PI*2;this.bobSpeed=Utils.getRandom(0.02,0.05);this.bobAmount=Utils.getRandom(1,2);}update(){this.lifespan--;this.bobAngle+=this.bobSpeed;this.y+=Math.sin(this.bobAngle)*this.bobAmount*0.1;return this.lifespan>0;}draw(ctx){const lifeRatio=Math.max(0,this.lifespan/Config.powerup.lifespanFrames);const pulse=1+Math.sin(Date.now()*0.01)*0.1;ctx.save();ctx.globalAlpha=lifeRatio*0.7+0.3;ctx.shadowBlur=Config.powerup.glowBlur*pulse;ctx.shadowColor=this.glowColor;ctx.fillStyle=this.color;ctx.beginPath();ctx.arc(this.x,this.y,this.radius*pulse*(0.5+lifeRatio*0.5),0,Math.PI*2);ctx.fill();ctx.restore();}}
// **Player Class with angle safety**
class Player { constructor(x,y){this.x=x;this.y=y;this.vx=0;this.vy=0;this.angle=0; /* Ensure initial angle is valid */ this.speed=Config.player.speed;this.radius=Config.player.collisionRadius;this.lastShotTime=0;this.isShieldActive=false;}
    update(im,cw,ch){const moveIn=im.getMovementVector();let moveX=moveIn.x;let moveY=moveIn.y;this.vx+=moveX*this.speed*0.15;this.vy+=moveY*this.speed*0.15;this.vx*=0.92;this.vy*=0.92;const curSpSq=this.vx*this.vx+this.vy*this.vy;const maxSpSq=this.speed*this.speed;if(curSpSq>maxSpSq){const curSp=Math.sqrt(curSpSq);this.vx=(this.vx/curSp)*this.speed;this.vy=(this.vy/curSp)*this.speed;}this.x+=this.vx;this.y+=this.vy;

        // --- Aiming Logic with Safety ---
        if(im.isTouchDevice){const moveMagSq=this.vx*this.vx+this.vy*this.vy;if(moveMagSq>0.01){const touchAngle=Math.atan2(this.vy,this.vx);if(!isNaN(touchAngle))this.angle=touchAngle;/* else keep previous angle */}/* else keep previous angle */}else{const dx=im.mousePos.x-this.x;const dy=im.mousePos.y-this.y;const mouseAngle=Math.atan2(dy,dx);if(!isNaN(mouseAngle))this.angle=mouseAngle;/* else keep previous angle */}

        // Boundary Checks
        if(this.x-this.radius<0){this.x=this.radius;this.vx=0;}if(this.x+this.radius>cw){this.x=cw-this.radius;this.vx=0;}if(this.y-this.radius<0){this.y=this.radius;this.vy=0;}if(this.y+this.radius>ch){this.y=ch-this.radius;this.vy=0;}

        // Firing Logic
        if(im.isTouchDevice){this.tryShoot();}else{if(im.isPrimaryFireHeld()){this.tryShoot();}}}
    tryShoot(){const now=Date.now();if(now-this.lastShotTime>Config.bullet.cooldown){
        // **NaN Check:** Ensure player angle is valid before creating bullet
        if (isNaN(this.angle)) {
            console.warn(`Player.tryShoot: Player angle is NaN. Cannot shoot.`);
            return false; // Don't shoot if angle is bad
        }
        const bX=this.x+Math.cos(this.angle)*(Config.player.width/2);const bY=this.y+Math.sin(this.angle)*(Config.player.width/2);Game.addBullet(new Bullet(bX,bY,this.angle));this.lastShotTime=now;return true;}return false;}
    draw(ctx){ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.angle);
    // DEBUG Radius // /* ctx.save(); ctx.strokeStyle='rgba(255,0,0,0.5)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(0,0,this.radius,0,Math.PI*2); ctx.stroke(); ctx.restore(); */
if(this.isShieldActive){const shieldPulse=1+Math.sin(Date.now()*0.005)*0.1;ctx.beginPath();ctx.arc(0,0,this.radius*1.5*shieldPulse,0,Math.PI*2);ctx.fillStyle='rgba(0,100,255,0.2)';ctx.strokeStyle=Config.player.glowColor;ctx.lineWidth=1.5;ctx.shadowBlur=15;ctx.shadowColor='#5af';ctx.fill();ctx.stroke();ctx.shadowBlur=0;} ctx.shadowBlur=Config.player.glowBlur;ctx.shadowColor=Config.player.glowColor;ctx.fillStyle=Config.player.color;const halfW=Config.player.width/2;const halfH=Config.player.height/2;ctx.beginPath();ctx.moveTo(halfW,0);ctx.lineTo(-halfW,-halfH);ctx.lineTo(-halfW,halfH);ctx.closePath();ctx.fill();ctx.restore();ctx.shadowBlur=0;ctx.shadowColor='transparent';}}

// ==================================
// UI MANAGER (No changes)
// ==================================
const UIManager = { drawActivePowerUps(ctx,ap,cw){ctx.save();ctx.textAlign='center';ctx.textBaseline='top';ctx.font='14px "Consolas","Courier New",monospace';let yOff=50;for(const typeId in ap){const remFrames=ap[typeId];const remSec=(remFrames/60).toFixed(1);const typeCfg=Config.powerup.types.find(t=>t.id===typeId);if(typeCfg){ctx.fillStyle=typeCfg.color;ctx.shadowColor=typeCfg.glowColor;ctx.shadowBlur=5;ctx.fillText(`${typeId.toUpperCase()}: ${remSec}s`,cw/2,yOff);yOff+=20;}}ctx.restore();},draw(ctx,s,dc,ap,cw){ctx.save();ctx.shadowBlur=Config.ui.glowBlur;ctx.shadowColor=Config.ui.glowColor;ctx.fillStyle=Config.ui.color;ctx.font=Config.ui.font;ctx.textBaseline='top';ctx.textAlign='left';ctx.fillText(`Score: ${s}`,20,20);ctx.textAlign='right';ctx.fillText(`Destroyed: ${dc}`,cw-20,20);ctx.restore();this.drawActivePowerUps(ctx,ap,cw);},drawGameOver(ctx,s,dc,cw,ch){ctx.save();ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(0,0,cw,ch);ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowBlur=15;ctx.shadowColor='#f00';ctx.fillStyle='#f00';ctx.font='48px "Consolas","Courier New",monospace';ctx.fillText('GAME OVER',cw/2,ch/2-60);ctx.shadowBlur=Config.ui.glowBlur;ctx.shadowColor=Config.ui.glowColor;ctx.fillStyle=Config.ui.color;ctx.font='32px "Consolas","Courier New",monospace';ctx.fillText(`Final Score: ${s}`,cw/2,ch/2);ctx.fillText(`Destroyed: ${dc}`,cw/2,ch/2+40);ctx.fillStyle='#fff';ctx.font='20px "Consolas","Courier New",monospace';ctx.shadowBlur=5;ctx.shadowColor='#fff';ctx.fillText('Restart (Tap Screen or Press R)',cw/2,ch/2+90);ctx.restore();}};

// ==================================
// GAME MANAGER (Ensure Game Over draws)
// ==================================
const Game = {
    // ... (properties no change) ...
    canvas: null, ctx: null, canvasWidth: 0, canvasHeight: 0, canvasCenterX: 0, canvasCenterY: 0,
    player: null, obstacles: [], bullets: [], particles: [], powerUps: [],
    state: null, activePowerUps: {}, _rafId: null, collisionCheckCounter: 0,

    init() { /* ... No changes ... */ this.canvas=document.getElementById('gameCanvas');if(!this.canvas){console.error("Canvas element not found!");return;}this.ctx=this.canvas.getContext('2d');this.state={score:0,destroyedCount:0,frameCount:0,isGameOver:false,};InputManager.init(this.canvas);this.resizeCanvas();this.reset();window.addEventListener('resize',this.resizeCanvas.bind(this));this.canvas.addEventListener('touchstart',this.handleCanvasTap.bind(this),{passive:true});console.log("Game Initialized - Hybrid Input Ready");this.gameLoop();},
    handleCanvasTap(e){if(InputManager.isTouchDevice&&this.state&&this.state.isGameOver){setTimeout(()=>{if(this.state.isGameOver){console.log("Restarting via tap...");this.restart();}},50);}},
    reset() { /* ... No changes ... */ console.log("Resetting game state...");if(this._rafId){cancelAnimationFrame(this._rafId);this._rafId=null;}this.clearAllPowerUpEffects();this.state.score=0;this.state.destroyedCount=0;this.state.frameCount=0;this.state.isGameOver=false;this.player=new Player(this.canvasCenterX,this.canvasCenterY);this.obstacles=[];this.bullets=[];this.particles=[];this.powerUps=[];this.activePowerUps={};Config.bullet.cooldown=Config.player.baseCooldown;InputManager.resetJoystick();InputManager.keysPressed={};InputManager.isMouseDown=false;},
    clearAllPowerUpEffects() { /* ... No changes ... */ console.log("Clearing PU effects...");for(const typeId in this.activePowerUps){const typeCfg=Config.powerup.types.find(t=>t.id===typeId);if(typeCfg&&typeCfg.removeEffect){try{typeCfg.removeEffect(this);}catch(e){console.error(`Error removing ${typeId} on clear:`,e);}}}this.activePowerUps={};},
    restart() { console.log("Restarting game..."); this.reset(); this.gameLoop(); },
    resizeCanvas() { /* ... No changes ... */ this.canvasWidth=window.innerWidth;this.canvasHeight=window.innerHeight;this.canvas.width=this.canvasWidth;this.canvas.height=this.canvasHeight;this.canvasCenterX=this.canvasWidth/2;this.canvasCenterY=this.canvasHeight/2;if(InputManager.isTouchDevice){InputManager.calculateJoystickCenter();}if(this.state&&this.state.isGameOver){UIManager.drawGameOver(this.ctx,this.state.score,this.state.destroyedCount,this.canvasWidth,this.canvasHeight);}},
    addBullet(b){if(!b||isNaN(b.x)||isNaN(b.y)||isNaN(b.vx)||isNaN(b.vy)){console.error("Attempted to add invalid bullet:",b);return;}this.bullets.push(b);},
    addParticleExplosion(x,y,c,gc,cnt=Config.particle.count){if(isNaN(x)||isNaN(y)){console.warn(`addParticleExplosion: Invalid coordinates (${x}, ${y}). Skipping.`);return;}for(let i=0;i<cnt;i++){this.particles.push(new Particle(x,y,c,gc));}},
    spawnObstacle(){this.obstacles.push(new Obstacle(this.canvasWidth,this.canvasHeight,this.canvasCenterX,this.canvasCenterY));},addPowerUp(p){if(!p||isNaN(p.x)||isNaN(p.y)){console.error("Attempted to add invalid powerup:",p);return;}this.powerUps.push(p);},
    spawnRandomPowerUp(x,y){if(isNaN(x)||isNaN(y)){console.warn(`spawnRandomPowerUp: Invalid coordinates (${x}, ${y}). Skipping.`);return;}if(Config.powerup.types.length===0)return;const rndIdx=Math.floor(Math.random()*Config.powerup.types.length);const selType=Config.powerup.types[rndIdx];this.addPowerUp(new PowerUp(x,y,selType));},
    applyPowerUpEffect(puType){const typeCfg=Config.powerup.types.find(t=>t.id===puType);if(!typeCfg||!typeCfg.applyEffect){console.warn(`PU type "${puType}" effect not found.`);return;}if(this.activePowerUps[puType]>0){console.log(`Refreshing ${puType}`);}try{typeCfg.applyEffect(this);}catch(e){console.error(`Error applying ${puType}:`,e);return;}if(typeCfg.duration>0){this.activePowerUps[puType]=typeCfg.duration;}},
    updateActivePowerUps(){let needsClean=false;for(const typeId in this.activePowerUps){this.activePowerUps[typeId]--;if(this.activePowerUps[typeId]<=0){const typeCfg=Config.powerup.types.find(t=>t.id===typeId);if(typeCfg&&typeCfg.removeEffect){try{typeCfg.removeEffect(this);}catch(e){console.error(`Error removing ${typeId}:`,e);}}needsClean=true;}}if(needsClean){for(const typeId in this.activePowerUps){if(this.activePowerUps[typeId]<=0){delete this.activePowerUps[typeId];}}}},
    update() { if(!this.state||this.state.isGameOver)return;this.state.frameCount++;if(this.player)this.player.update(InputManager,this.canvasWidth,this.canvasHeight);this.bullets=this.bullets.filter(b=>b&&b.update(this.canvasWidth,this.canvasHeight));this.obstacles=this.obstacles.filter(o=>o&&o.update(this.canvasCenterX,this.canvasCenterY));this.particles=this.particles.filter(p=>p&&p.update());this.powerUps=this.powerUps.filter(p=>p&&p.update());this.updateActivePowerUps();if(this.state.frameCount%Config.obstacle.spawnRate===0){this.spawnObstacle();}this.checkCollisions();if(!this.state.isGameOver){this.state.score++;}},

    // checkCollisions with Logs (Keep uncommented for now)
    checkCollisions() {
        if (!this.state || !this.player) return;
        const shouldLog = (this.collisionCheckCounter++ % 60 === 0);

        const P_X = this.player.x; const P_Y = this.player.y; const P_R = this.player.radius;
        if (isNaN(P_X) || isNaN(P_Y) || isNaN(P_R)) { console.error("Player position or radius is NaN!"); return; }

        // Player <-> Obstacle
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
             const obs = this.obstacles[i];
             if (!obs) continue;
             const O_X = obs.x; const O_Y = obs.y; const O_R = obs.radius;
             if (isNaN(O_X) || isNaN(O_Y) || isNaN(O_R)) { console.error(`Obstacle ${i} position or radius is NaN!`); continue; }
             const distSq = Utils.getDistanceSq(P_X, P_Y, O_X, O_Y);
             const radiiSumSq = Math.pow(P_R + O_R, 2);
             if (shouldLog && this.obstacles.length > 0) { console.log(`P(${P_X.toFixed(0)}, R:${P_R}) vs O${i}(${O_X.toFixed(0)}, R:${O_R}) | dSq:${distSq.toFixed(0)}, rSumSq:${radiiSumSq.toFixed(0)} | Shld:${this.player.isShieldActive}`); }
             if (distSq < radiiSumSq) {
                 console.log(`!!! Collision: Player vs Obstacle ${i} !!!`);
                 if (this.player.isShieldActive) {
                     this.addParticleExplosion(O_X, O_Y, obs.color, obs.glowColor, Config.particle.count / 2);
                     this.addParticleExplosion(P_X, P_Y, Config.player.color, Config.player.glowColor, 5);
                     this.obstacles.splice(i, 1);
                     console.log(`   Shield hit by Obstacle ${i}`);
                     continue;
                 } else {
                     console.log("   Game Over - Obstacle Collision - Setting state");
                     this.state.isGameOver = true; // *** Ensure this is set ***
                     this.clearAllPowerUpEffects();
                     this.addParticleExplosion(P_X, P_Y, Config.player.color, Config.player.glowColor, 30);
                     this.addParticleExplosion(O_X, O_Y, obs.color, obs.glowColor);
                     this.obstacles.splice(i, 1);
                     return; // Exit collision checks immediately
                 }
             }
         }

        // Bullet <-> Obstacle
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            if (!bullet) continue;
            const B_X = bullet.x; const B_Y = bullet.y; const B_R = bullet.radius;
            if (isNaN(B_X) || isNaN(B_Y) || isNaN(B_R)) { console.error(`Bullet ${i} state is NaN!`); this.bullets.splice(i, 1); continue; } // Remove bad bullets

            for (let j = this.obstacles.length - 1; j >= 0; j--) {
                 const obs = this.obstacles[j];
                 if (!obs) continue;
                 const O_X = obs.x; const O_Y = obs.y; const O_R = obs.radius;
                 if (isNaN(O_X) || isNaN(O_Y) || isNaN(O_R)) { console.error(`Obstacle ${j} state is NaN!`); this.obstacles.splice(j, 1); continue; } // Remove bad obstacles

                 const distSq = Utils.getDistanceSq(B_X, B_Y, O_X, O_Y);
                 const radiiSumSq = Math.pow(B_R + O_R, 2);
                 if (shouldLog && this.bullets.length > 0 && this.obstacles.length > 0) { console.log(`  B${i}(R:${B_R}) vs O${j}(R:${O_R}) | dSq:${distSq.toFixed(0)}, rSumSq:${radiiSumSq.toFixed(0)}`); }
                 if (distSq < radiiSumSq) {
                     console.log(`!!! Collision: Bullet ${i} hit Obstacle ${j} !!!`);
                     this.addParticleExplosion(O_X, O_Y, obs.color, obs.glowColor);
                     const spawnX = obs.x; const spawnY = obs.y;
                     this.obstacles.splice(j, 1);
                     this.bullets.splice(i, 1);
                     this.state.destroyedCount++;
                     if (Math.random() < Config.powerup.spawnChance) { this.spawnRandomPowerUp(spawnX, spawnY); }
                     break; // Exit inner loop (j)
                 }
            }
        }

         // Player <-> PowerUp Item
         for (let i = this.powerUps.length - 1; i >= 0; i--) {
             const puItem = this.powerUps[i];
             if (!puItem) continue;
             const PU_X = puItem.x; const PU_Y = puItem.y; const PU_R = puItem.radius;
             if (isNaN(PU_X) || isNaN(PU_Y) || isNaN(PU_R)) { console.error(`PowerUp ${i} state is NaN!`); this.powerUps.splice(i, 1); continue; }
             const distSq = Utils.getDistanceSq(P_X, P_Y, PU_X, PU_Y);
             const radiiSumSq = Math.pow(P_R + PU_R, 2);
             if (shouldLog && this.powerUps.length > 0) { console.log(`    P(R:${P_R}) vs PU${i}(R:${PU_R}) | dSq:${distSq.toFixed(0)}, rSumSq:${radiiSumSq.toFixed(0)}`); }
             if (distSq < radiiSumSq) {
                 console.log(`!!! Collision: Player collected PowerUp ${i} (${puItem.type}) !!!`);
                 this.applyPowerUpEffect(puItem.type);
                 this.powerUps.splice(i, 1);
                 this.addParticleExplosion(PU_X, PU_Y, puItem.color, puItem.glowColor, 8);
             }
         }
    },


    draw() { if(!this.ctx)return;this.ctx.fillStyle=`rgba(0,0,0,${Config.canvasClearAlpha})`;this.ctx.fillRect(0,0,this.canvasWidth,this.canvasHeight);this.obstacles.forEach(o=>o.draw(this.ctx));this.bullets.forEach(b=>b.draw(this.ctx));this.particles.forEach(p=>p.draw(this.ctx));this.powerUps.forEach(p=>p.draw(this.ctx));if(this.player){this.player.draw(this.ctx);}if(this.state){UIManager.draw(this.ctx,this.state.score,this.state.destroyedCount,this.activePowerUps,this.canvasWidth);}},

    // Revised Game Loop with check *before* update/draw
    gameLoop() {
        // --- Check Game Over State FIRST ---
         if (this.state && this.state.isGameOver) {
            console.log("Game Loop: Game Over detected, drawing screen."); // Log game over detection
            UIManager.drawGameOver(this.ctx, this.state.score, this.state.destroyedCount, this.canvasWidth, this.canvasHeight);
            this._rafId = null; // Clear animation frame ID
            return; // Stop the loop HERE
        }

        // --- If not game over, proceed with update and draw ---
        try { this.update(); }
        catch(e) { console.error("Error during Game.update:", e); if(this.state) this.state.isGameOver = true; /* Attempt graceful stop */ }

        try { this.draw(); }
        catch(e) { console.error("Error during Game.draw:", e); if(this.state) this.state.isGameOver = true; /* Attempt graceful stop */ }

        // --- Request next frame ONLY if game should continue ---
        if (!this.state || !this.state.isGameOver) { // Double check state before requesting next frame
             this._rafId = requestAnimationFrame(this.gameLoop.bind(this));
        } else {
             console.log("Game Loop: Game Over flag set after update/draw, stopping loop.");
             // Redraw game over screen one last time ensure it's shown
             UIManager.drawGameOver(this.ctx, this.state.score, this.state.destroyedCount, this.canvasWidth, this.canvasHeight);
             this._rafId = null;
        }
    }
};

// ==================================
// START THE GAME
// ==================================
document.addEventListener('DOMContentLoaded', () => {
    try { console.log("DOM Loaded. Initializing Game..."); Game.init(); }
    catch (error) { console.error("Error initializing Game:", error); document.body.innerHTML = `<div style="color: red; padding: 20px; font-family: monospace;">FATAL ERROR DURING INITIALIZATION. Check console (F12).<br><pre>${error.stack || error}</pre></div>`; }
});
