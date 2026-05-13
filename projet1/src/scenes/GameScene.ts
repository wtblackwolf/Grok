import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  // Contrôles mobiles
  private joystickBase!: Phaser.GameObjects.Graphics;
  private joystickThumb!: Phaser.GameObjects.Graphics;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private moveVector = { x: 0, y: 0 };

  private actionButtons: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super('GameScene');
  }

  preload() {
    this.load.image('wizard', 'https://picsum.photos/id/1015/128/128');
  }

  create() {
    this.add.rectangle(0, 0, 3000, 3000, 0x1a0033).setOrigin(0);

    this.add.grid(640, 360, 30, 30, 64, 32, 0x2a1a4d, 0.8, 0x3a2a6d);

    this.player = this.add.sprite(640, 360, 'wizard').setScale(2.5).setTint(0x8a2be2);
    this.player.setDepth(100);

    this.cursors = this.input.keyboard!.createCursorKeys();

    this.setupVirtualJoystick();
    this.setupActionButtons();

    this.add.text(20, 20, 'Joystick gauche (mobile)\nFlèches / WASD (PC)', {
      fontSize: '16px', color: '#fff', backgroundColor: '#00000088'
    }).setScrollFactor(0).setDepth(200);
  }

  private setupVirtualJoystick() {
    this.joystickBase = this.add.graphics().setDepth(300);
    this.joystickThumb = this.add.graphics().setDepth(301);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x < this.scale.width * 0.45) {
        this.isDragging = true;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
        this.showJoystick(pointer.x, pointer.y);
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      this.updateJoystick(pointer.x, pointer.y);
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
      this.hideJoystick();
      this.moveVector = { x: 0, y: 0 };
    });
  }

  private showJoystick(x: number, y: number) {
    this.joystickBase.clear();
    this.joystickBase.fillStyle(0x000000, 0.3);
    this.joystickBase.fillCircle(x, y, 60);

    this.joystickThumb.clear();
    this.joystickThumb.fillStyle(0x8a2be2, 0.8);
    this.joystickThumb.fillCircle(x, y, 25);
  }

  private updateJoystick(x: number, y: number) {
    const dx = x - this.dragStartX;
    const dy = y - this.dragStartY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const maxDist = 55;

    const angle = Math.atan2(dy, dx);
    const moveDist = Math.min(dist, maxDist);

    const thumbX = this.dragStartX + Math.cos(angle) * moveDist;
    const thumbY = this.dragStartY + Math.sin(angle) * moveDist;

    this.joystickThumb.clear();
    this.joystickThumb.fillStyle(0x8a2be2, 0.9);
    this.joystickThumb.fillCircle(thumbX, thumbY, 25);

    this.moveVector.x = dx / maxDist;
    this.moveVector.y = dy / maxDist;
  }

  private hideJoystick() {
    this.joystickBase.clear();
    this.joystickThumb.clear();
  }

  private setupActionButtons() {
    const btnSize = 70;
    const startX = this.scale.width - 100;
    const startY = this.scale.height - 220;
    const labels = ['Projectile', 'Sort principal', 'Défense', 'Invocation'];
    const colors = [0xff00ff, 0x00ffff, 0xffff00, 0x00ff00];

    for (let i = 0; i < 4; i++) {
      const btn = this.add.rectangle(startX, startY + i * (btnSize + 20), btnSize, btnSize, colors[i])
        .setAlpha(0.75).setDepth(300);

      this.add.text(btn.x - 25, btn.y - 10, labels[i], {
        fontSize: '12px', color: '#000', align: 'center'
      }).setDepth(301);

      btn.setInteractive();
      btn.on('pointerdown', () => {
        console.log(`Sort ${i+1} (${labels[i]}) activé !`);
        btn.setAlpha(1);
        this.time.delayedCall(150, () => btn.setAlpha(0.75));
      });

      this.actionButtons.push(btn);
    }
  }

  update() {
    const speed = 4;
    let vx = 0, vy = 0;

    // Clavier
    if (this.cursors.left?.isDown || this.input.keyboard?.addKey('A').isDown) vx -= 1;
    if (this.cursors.right?.isDown || this.input.keyboard?.addKey('D').isDown) vx += 1;
    if (this.cursors.up?.isDown || this.input.keyboard?.addKey('W').isDown) vy -= 1;
    if (this.cursors.down?.isDown || this.input.keyboard?.addKey('S').isDown) vy += 1;

    // Joystick
    if (this.isDragging) {
      vx = this.moveVector.x;
      vy = this.moveVector.y;
    }

    if (vx !== 0 && vy !== 0) {
      vx *= 0.7071;
      vy *= 0.7071;
    }

    this.player.x += vx * speed;
    this.player.y += vy * speed;
  }
}