export class WorldCamera {
  x = 0
  y = 0
  zoom = 1
  private targetX = 0
  private look = 0
  private looking = false
  private smoothing = 0.08
  private lookReturn = 0.14

  /** Keep the playhead in view. `look` is a user peek on top of follow. */
  followPlayhead(worldX: number, viewportWidth: number): void {
    this.targetX = Math.max(0, worldX - viewportWidth * 0.3)
    if (!this.looking) this.look += (0 - this.look) * this.lookReturn
    if (Math.abs(this.look) < 0.15) this.look = 0
    const desired = Math.max(0, this.targetX + this.look)
    if (this.looking) this.x = desired
    else this.x += (desired - this.x) * this.smoothing
    if (this.x < 0) this.x = 0
  }

  setPosition(x: number): void {
    this.x = x
    this.targetX = x
    this.look = 0
    this.looking = false
  }

  /**
   * Drag / wheel / page skip.
   * When `peek` is set, the playhead still owns the camera and this is a temporary look-ahead.
   */
  pan(dx: number, peek = false): void {
    if (peek) {
      this.look += dx
      this.x = Math.max(0, this.targetX + this.look)
      return
    }
    this.x = Math.max(0, this.x + dx)
    this.targetX = this.x
    this.look = 0
  }

  beginLook(): void {
    this.looking = true
  }

  endLook(): void {
    this.looking = false
  }

  setZoom(zoom: number): void {
    this.zoom = Math.max(0.5, Math.min(2, zoom))
  }

  worldToScreen(worldX: number, worldY: number): { sx: number; sy: number } {
    return {
      sx: (worldX - this.x) * this.zoom,
      sy: worldY * this.zoom,
    }
  }

  reset(): void {
    this.x = 0
    this.y = 0
    this.targetX = 0
    this.look = 0
    this.looking = false
  }
}
