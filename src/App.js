import React, { useEffect, useRef, useState } from 'react';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLANE_WIDTH = 20;
const PLANE_HEIGHT = 10;
const TERRAIN_POINTS = 5000;
const VISIBLE_TERRAIN_POINTS = 200;
const MAX_TERRAIN_HEIGHT = CANVAS_HEIGHT * 3 / 8;
const TURRET_SIZE = 20;
const BULLET_SIZE = 5;
const BULLET_SPEED = 0.15;
const BOMB_WIDTH = 4;
const BOMB_HEIGHT = 6;
const BOMB_SPEED = 2;
const BOMB_GRAVITY = 0.000005;
const EXPLOSION_RADIUS = 30;
const FIRE_INTERVAL = 1750; // 2 seconds in milliseconds
const MAX_SPEED = 0.75;
const TURRET_SPAWN_DELAY = 5000; // 5 seconds delay for turret spawn
const WORLD_WIDTH = CANVAS_WIDTH * 40;  // 40 screens wide
const ROTATION_SPEED = 3;

const AirplaneGame = () => {
  const canvasRef = useRef(null);
  const [angle, setAngle] = useState(0);
  const [speed, setSpeed] = useState(0.2);
  const [planeX, setPlaneX] = useState(WORLD_WIDTH / 2);
  const [planeY, setPlaneY] = useState(CANVAS_HEIGHT / 2);
  const [terrain, setTerrain] = useState([]);
  const [turrets, setTurrets] = useState([]);
  const [bullets, setBullets] = useState([]);
  const [bombs, setBombs] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameStartTime, setGameStartTime] = useState(0);
  const lastFireTime = useRef({});

  useEffect(() => {
    generateTerrain();
    setGameStartTime(Date.now());
  }, []);

  useEffect(() => {
    const spawnTurretsTimer = setTimeout(() => {
      generateTurrets();
    }, TURRET_SPAWN_DELAY);

    return () => clearTimeout(spawnTurretsTimer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameOver) return;
      switch (e.key) {
        case 'ArrowLeft':
          setAngle(prev => (prev - ROTATION_SPEED * 5 + 360) % 360);
          break;
        case 'ArrowRight':
          setAngle(prev => (prev + ROTATION_SPEED * 5) % 360);
          break;
        case 'ArrowUp':
          setSpeed(prev => Math.min(prev + 0.05, MAX_SPEED));
          break;
        case 'ArrowDown':
          setSpeed(prev => Math.max(prev - 0.05, -MAX_SPEED));
          break;
        case ' ':  // Spacebar
          setBombs(prev => [...prev, { x: planeX, y: planeY, vx: speed * Math.cos(-angle * Math.PI / 180), vy: 0 }]);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver, planeX, planeY, angle, speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const checkCollision = () => {
      // Check world boundaries
      if (planeX < 0 || planeX > WORLD_WIDTH || planeY < 0 || planeY > CANVAS_HEIGHT) {
        return true;
      }

      // Check terrain collision
      const terrainIndex = Math.floor(planeX / (WORLD_WIDTH / TERRAIN_POINTS));
      if (planeY + PLANE_HEIGHT / 2 > CANVAS_HEIGHT - terrain[terrainIndex]) {
        return true;
      }

      // Check bullet collision
      for (let bullet of bullets) {
        const dx = bullet.x - planeX;
        const dy = bullet.y - planeY;
        if (Math.sqrt(dx * dx + dy * dy) < PLANE_WIDTH / 2 + BULLET_SIZE) {
          return true;
        }
      }

      return false;
    };

    const explodeBomb = (bomb) => {
      // Remove terrain within explosion radius
      setTerrain(prev => prev.map((height, index) => {
        const terrainX = index * (WORLD_WIDTH / TERRAIN_POINTS);
        const dx = terrainX - bomb.x;
        const dy = (CANVAS_HEIGHT - height) - bomb.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < EXPLOSION_RADIUS) {
          return Math.max(height - (EXPLOSION_RADIUS - distance), 0);
        }
        return height;
      }));

      // Remove turrets within explosion radius
      setTurrets(prev => prev.filter(turret => {
        const dx = turret.x - bomb.x;
        const dy = (CANVAS_HEIGHT - terrain[Math.floor(turret.x / (WORLD_WIDTH / TERRAIN_POINTS))]) - bomb.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance >= EXPLOSION_RADIUS;
      }));
    };

    const render = (timestamp) => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      if (!gameOver) {
        // Update plane position
        const radians = -angle * Math.PI / 180;
        setPlaneX(prev => Math.max(0, Math.min(prev + Math.cos(radians) * speed, WORLD_WIDTH)));
        setPlaneY(prev => Math.max(PLANE_HEIGHT / 2, Math.min(prev + Math.sin(radians) * speed, CANVAS_HEIGHT - PLANE_HEIGHT / 2)));
      }

      // Calculate visible area
      const startX = Math.max(0, planeX - CANVAS_WIDTH / 2);
      const endX = Math.min(WORLD_WIDTH, startX + CANVAS_WIDTH);

      // Draw terrain
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_HEIGHT);
      const startIndex = Math.floor(startX / (WORLD_WIDTH / TERRAIN_POINTS));
      const endIndex = Math.floor(endX / (WORLD_WIDTH / TERRAIN_POINTS));
      for (let i = startIndex; i <= endIndex; i++) {
        const x = (i * (WORLD_WIDTH / TERRAIN_POINTS) - startX) * (CANVAS_WIDTH / (endX - startX));
        ctx.lineTo(x, CANVAS_HEIGHT - terrain[i]);
      }
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = 'green';
      ctx.fill();

      // Draw and update turrets
      turrets.forEach((turret, index) => {
        if (turret.x >= startX && turret.x <= endX) {
          const turretX = (turret.x - startX) * (CANVAS_WIDTH / (endX - startX));
          const turretY = CANVAS_HEIGHT - terrain[Math.floor(turret.x / (WORLD_WIDTH / TERRAIN_POINTS))];
          ctx.fillStyle = 'brown';
          ctx.fillRect(turretX - TURRET_SIZE/2, turretY - TURRET_SIZE, TURRET_SIZE, TURRET_SIZE);
          
          // Calculate angle to plane
          const dx = planeX - turret.x;
          const dy = planeY - turretY + TURRET_SIZE/2;
          const turretAngle = Math.atan2(dy, dx);
          
          // Draw turret barrel
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(turretX, turretY - TURRET_SIZE/2);
          ctx.lineTo(turretX + Math.cos(turretAngle) * TURRET_SIZE, turretY - TURRET_SIZE/2 + Math.sin(turretAngle) * TURRET_SIZE);
          ctx.stroke();

          // Fire bullet every 2 seconds
          if (!gameOver && (!lastFireTime.current[index] || timestamp - lastFireTime.current[index] >= FIRE_INTERVAL)) {
            setBullets(prev => [...prev, {
              x: turret.x,
              y: turretY - TURRET_SIZE/2,
              angle: turretAngle
            }]);
            lastFireTime.current[index] = timestamp;
          }
        }
      });

      // Update and draw bullets
      setBullets(prev => prev.map(bullet => ({
        ...bullet,
        x: bullet.x + Math.cos(bullet.angle) * BULLET_SPEED,
        y: bullet.y + Math.sin(bullet.angle) * BULLET_SPEED
      })).filter(bullet => 
        bullet.x >= 0 && bullet.x <= WORLD_WIDTH && 
        bullet.y >= 0 && bullet.y <= CANVAS_HEIGHT
      ));

      bullets.forEach(bullet => {
        if (bullet.x >= startX && bullet.x <= endX) {
          const bulletX = (bullet.x - startX) * (CANVAS_WIDTH / (endX - startX));
          ctx.fillStyle = 'red';
          ctx.beginPath();
          ctx.arc(bulletX, bullet.y, BULLET_SIZE, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Update and draw bombs
      setBombs(prev => prev.map(bomb => {
        const newBomb = {
          ...bomb,
          x: bomb.x + bomb.vx,
          y: bomb.y + bomb.vy,
          vy: bomb.vy + BOMB_GRAVITY
        };
        const terrainIndex = Math.floor(newBomb.x / (WORLD_WIDTH / TERRAIN_POINTS));
        if (newBomb.y > CANVAS_HEIGHT - terrain[terrainIndex]) {
          explodeBomb(newBomb);
          return null;
        }
        return newBomb;
      }).filter(bomb => bomb !== null));

      bombs.forEach(bomb => {
        if (bomb.x >= startX && bomb.x <= endX) {
          const bombX = (bomb.x - startX) * (CANVAS_WIDTH / (endX - startX));
          ctx.fillStyle = 'black';
          ctx.beginPath();
          ctx.ellipse(bombX, bomb.y, BOMB_WIDTH / 2, BOMB_HEIGHT / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw plane
      ctx.save();
      ctx.translate(CANVAS_WIDTH / 2, planeY);
      ctx.rotate(-angle * Math.PI / 180);
      
      // Draw plane body
      ctx.fillStyle = 'gray';
      ctx.beginPath();
      ctx.moveTo(-PLANE_WIDTH/2, 0);
      ctx.lineTo(PLANE_WIDTH/2, 0);
      ctx.lineTo(PLANE_WIDTH/2 + PLANE_HEIGHT/2, PLANE_HEIGHT/2);
      ctx.lineTo(-PLANE_WIDTH/2, PLANE_HEIGHT/2);
      ctx.closePath();
      ctx.fill();

      // Draw wings
      ctx.fillStyle = 'darkgray';
      ctx.fillRect(-PLANE_WIDTH/4, -PLANE_HEIGHT, PLANE_WIDTH/2, PLANE_HEIGHT);

      // Draw cockpit
      ctx.fillStyle = 'lightblue';
      ctx.beginPath();
      ctx.arc(PLANE_WIDTH/4, 0, PLANE_HEIGHT/4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Check for collision
      if (!gameOver && checkCollision()) {
        setGameOver(true);
      }

      // Draw game over text
      if (gameOver) {
        ctx.fillStyle = 'black';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [angle, speed, planeX, planeY, terrain, turrets, bullets, bombs, gameOver]);

  const generateTerrain = () => {
    const newTerrain = [];
    let currentHeight = Math.random() * MAX_TERRAIN_HEIGHT;
    for (let i = 0; i < TERRAIN_POINTS; i++) {
      const targetHeight = Math.random() * MAX_TERRAIN_HEIGHT;
      const steps = Math.floor(Math.random() * 20) + 10; // 10 to 29 steps for smoother slopes
      for (let j = 0; j < steps && i < TERRAIN_POINTS; j++, i++) {
        currentHeight += (targetHeight - currentHeight) / (steps - j);
        newTerrain.push(currentHeight);
      }
      i--; // Adjust for the extra increment in the outer loop
    }
    setTerrain(newTerrain);
  };

  const generateTurrets = () => {
    const newTurrets = [];
    for (let i = 0; i < 20; i++) {  // Increased number of turrets
      newTurrets.push({
        x: i * (WORLD_WIDTH / 20) + Math.random() * (WORLD_WIDTH / 20), // Spread turrets over the world
        terrainIndex: i * (TERRAIN_POINTS / 20) + Math.floor(Math.random() * (TERRAIN_POINTS / 20))
      });
    }
    setTurrets(newTurrets);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border border-gray-300"
      />
      <div className="mt-4 text-center">
        <p>Use arrow keys to control the plane:</p>
        <p>↑↓ - Adjust speed (positive is forward, negative is backward) | ←→ - Change angle</p>
        <p>Press SPACEBAR to drop bombs</p>
        <p>Current Speed: {speed.toFixed(2)} | Current Angle: {angle}°</p>
        <p>Avoid the terrain and bullets! Destroy turrets and terrain with bombs!</p>
        {gameOver && <p className="text-red-500 font-bold">Game Over! Refresh to play again.</p>}
      </div>
    </div>
  );
};

export default AirplaneGame;