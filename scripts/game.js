(() => {
    var legacyMode = false

    class Projectile {
        constructor(
            x, y, radius,
            veloX, veloY
        ) {
            this.x = x
            this.y = y
            this.radius = radius
            this.veloX = veloX
            this.veloY = veloY
        }

        /**
         * 
         * @param {Number} time 
         */
        advance(time) {
            this.x += this.veloX * time
            this.y += this.veloY * time
        }
    }

    class Collider {
        /**
         * @param {Projectile} projectile 
         * @returns {Boolean}
         */
        hitTest(projectile) {
            return false
        }
    }

    class RingElement extends Collider {
        /**
         * 
         * @param {CanvasRenderingContext2D} context
         */
        render(context) {}

        /**
         * 
         * @param {Number} dAngle 
         */
        rotate(dAngle) {}

        /**
         * 
         * @param {Number} time 
         */
        advance(time) {}
    }

    class RingBall extends RingElement {
        constructor(angle, distance, radius) {
            super()

            this.angle = angle
            this.distance = distance
            this.radius = radius
        }

        /**
         * @param {Projectile} projectile 
         * @returns {Boolean}
         */
        hitTest(projectile) {
            return Math.hypot(
                this.distance * Math.cos(2 * Math.PI * this.angle) - projectile.x,
                this.distance * Math.sin(2 * Math.PI * this.angle) - projectile.y
            ) < (this.radius + projectile.radius)
        }

        rotate(dAngle) {
            this.angle += dAngle
        }

        render(context) {
            context.beginPath()

            context.arc(
                this.distance * Math.cos(2 * Math.PI * this.angle) + context.canvas.width / 2,
                this.distance * Math.sin(2 * Math.PI * this.angle) + context.canvas.height / 2,
                this.radius,
                0, 2 * Math.PI
            )

            context.fill()
        }
    }

    class RingPulsingBall extends RingBall {
        constructor(angle, distance, radius, pulseFreq) {
            super(angle, distance, radius)

            this.baseRadius = radius
            this.pulseTime = 0
            this.pulseFreq = pulseFreq
        }

        advance(dTime) {
            this.pulseTime += dTime

            this.radius = this.baseRadius + Math.sin(this.pulseTime * 2 * Math.PI * this.pulseFreq) * this.baseRadius / 3
        }
    }

    class RingBar extends RingElement {
        constructor(angleStart, angleLength, distance, radius) {
            super()

            this.angleStart = angleStart
            this.angleLength = angleLength
            this.distance = distance
            this.radius = radius
        }

        /**
         * @param {Projectile} projectile 
         * @returns {Boolean}
         */
        hitTest(projectile) {
            var projAngle = Math.atan2(
                projectile.y, projectile.x
            )
            if (projAngle < 0) projAngle += Math.PI * 2
            projAngle /= Math.PI * 2

            var projDist = Math.hypot(projectile.x, projectile.y)

            var clampedStart = this.angleStart % 1
            var clampedEnd = (clampedStart + this.angleLength) % 1

            var mightCollide = false

            if (clampedStart < clampedEnd) {
                mightCollide = projAngle > clampedStart && projAngle < clampedEnd
            } else {
                mightCollide = projAngle > clampedStart || projAngle < clampedEnd
            }

            if (mightCollide && Math.abs(projDist - this.distance) < (this.radius + projectile.radius))
                return true
            return false
        }

        rotate(dAngle) {
            this.angleStart += dAngle
        }

        render(context) {
            context.beginPath()

            context.lineWidth = this.radius * 2

            context.arc(
                context.canvas.width / 2,
                context.canvas.height / 2,
                this.distance,
                2 * Math.PI * this.angleStart,
                2 * Math.PI * (this.angleStart + this.angleLength)
            )

            context.stroke()
        }
    }

    class RingMarqueeBar extends RingBar {
        constructor(angleStart, angleLength, distance, radius, sweepFreq) {
            super(angleStart, angleLength, distance, radius)
        
            this.sweepFreq = sweepFreq
            this.sweepTime = 0

            this.baseStart = angleStart
            this.baseEnd = angleStart + angleLength
        }

        advance(dTime) {
            this.sweepTime += dTime
            
            var sin = Math.sin(this.sweepTime * 2 * Math.PI * this.sweepFreq) / 2 + 0.5
            this.angleLength = sin * (this.baseEnd - this.baseStart)
            this.angleStart = (this.baseStart + this.baseEnd) / 2 - this.angleLength / 2
        }

        rotate(dAngle) {
            this.baseStart += dAngle
            this.baseEnd += dAngle
        }
    }

    /**
     * Represents a ring of obstacles
     */
    class Ring {
        constructor(
            level,
            speedMult,
            isDistraction
        ) {
            /**
             * @type {Level}
             */
            this.level = level

            /**
             * @type {Number}
             */
            this.speedMult = speedMult

            /**
             * @type {Number}
             */
            this.rotation = 0

            /**
             * @type {RingElement[]}
             */
            this.elements = []

            /**
             * @type {Boolean}
             */
            this.isDistraction = isDistraction
        }
        /**
         * 
         * @param {CanvasRenderingContext2D} context
         */
        render(context) {
            context.globalAlpha = 1
            if (this.isDistraction) context.globalAlpha = 0.4
            this.elements.forEach(element => element.render(context))
            context.globalAlpha = 1
        }

        advance(time) {
            this.rotation += time * this.speedMult
            this.elements.forEach(element => {
                element.rotate(time * this.speedMult)
                element.advance(time)
            })
        }

        /**
         * 
         * @param {Projectile} projectile 
         * @returns {RingElement}
         */
        getCollidingObject(projectile) {
            for (var element of this.elements) {
                if (element.hitTest(projectile)) return element
            }
            return null
        }
    }

    class Level {
        constructor(bpm) {
            /**
             * @type {Ring[]}
             */
            this.rings = []

            /**
             * @type {Number}
             */
            this.bpm = bpm

            /**
             * @type {Number}
             */
            this.rotation = 0
        }

        static create(difficulties) {
            var level = new Level(16.25)

            var innerRing = new Ring(level, 1)
            innerRing.elements = level.generateInnerRing(difficulties[0])
            level.rings.push(innerRing)

            var middleRing = new Ring(level, 0.5)
            if (difficulties[1]) {
                middleRing.elements = level.generateMiddleRing(difficulties[1])
            }
            level.rings.push(middleRing)

            var outerRing = new Ring(level, 0.25)
            if (difficulties[2]) {
                outerRing.elements = level.generateOuterRing(difficulties[2])
            }
            level.rings.push(outerRing)

            return level
        }

        static createDenise() {
            var level = new Level(16.25)

            let difficulties = Array(3).fill(0).map(x => Math.floor(Math.random() * 2 + 2))

            var innerRing = new Ring(level, 1)
            innerRing.elements = level.generateDeniseRing(4, 200)
            level.rings.push(innerRing)

            var middleRing = new Ring(level, 0.5)
            middleRing.elements = level.generateDeniseRing(4, 266)
            level.rings.push(middleRing)

            var outerRing = new Ring(level, 0.25)
            outerRing.elements = level.generateDeniseRing(4, 333)
            level.rings.push(outerRing)

            var outerRing2 = new Ring(level, 0.25)
            outerRing2.elements = level.generateDeniseRing(4, 400)
            level.rings.push(outerRing2)

            return level
        }

        static createHell() {
            var level = new Level(16.25)

            var innerRing = new Ring(level, 1)
            innerRing.elements = level.generateInnerRing(2)
            level.rings.push(innerRing)

            var innerRing2 = new Ring(level, 0.5)
            innerRing2.elements = level.generateInnerRing(2)
            level.rings.push(innerRing2)

            var middleRing = new Ring(level, 0.5)
            middleRing.elements = level.generateMiddleRing(3)
            level.rings.push(middleRing)

            var outerRing = new Ring(level, 0.25)
            outerRing.elements = level.generateOuterRing(3)
            level.rings.push(outerRing)

            var outerRing2 = new Ring(level, 0.125)
            outerRing2.elements = level.generateOuterRing(3)
            level.rings.push(outerRing2)

            return level
        }

        static createHades() {
            var level = new Level(16.25)

            var innerRing = new Ring(level, 1)
            innerRing.elements = level.generateInnerRing(1, 100)
            level.rings.push(innerRing)

            var middleRing = new Ring(level, 0.5)
            middleRing.elements = level.generateInnerRing(3, 300)
            level.rings.push(middleRing)

            var outerRing1 = new Ring(level, 0.25)
            outerRing1.elements = level.generateOuterRing(3)
            level.rings.push(outerRing1)

            var outerRing2 = new Ring(level, 0.125)
            outerRing2.elements = level.generateOuterRing(3)
            level.rings.push(outerRing2)

            // Distractions
            var middleRing = new Ring(level, 1)
            middleRing.isDistraction = true
            middleRing.elements = level.generateMiddleRing(3)
            level.rings.push(middleRing)

            var outerRing3 = new Ring(level, 0.5)
            outerRing3.isDistraction = true
            outerRing3.elements = level.generateOuterRing(3)
            level.rings.push(outerRing3)

            var innerRing2 = new Ring(level, 0.75)
            innerRing2.isDistraction = true
            innerRing2.elements = level.generateInnerRing(2, 150)
            level.rings.push(innerRing2)

            return level
        }

        advance(time) {
            var beatTime = 60 / this.bpm
            this.rotation += time / beatTime

            this.rings.forEach(ring => ring.advance(time / beatTime))
        }

        /**
         * 
         * @param {CanvasRenderingContext2D} context
         */
        render(context) {
            this.rings.forEach(ring => ring.render(context))
        }

        /**
         * 
         * @param {Projectile} projectile 
         * @returns {RingElement}
         */
        getCollidingObject(projectile) {
            for (var ring of this.rings) {
                if (ring.isDistraction) continue
                var element = ring.getCollidingObject(projectile)
                if (element) return element
            }
            return null
        }

        generateAngleArrangement(n, isSmall, isEasy) {
            var angleBetween = 1 / n
            var shiftAngle = angleBetween / 3
            var isShifted = Math.random() >= 0.5
            if (isEasy) isShifted = false
            var shiftSign = (Math.random() >= 0.5) ? 1 : -1
    
            var angles = []
    
            for (var i = 0; i < n; i++) {
                var angle = i * angleBetween
    
                if (isShifted && n == 4 && i % 2) {
                    angle += shiftSign * shiftAngle
                } else if (isShifted && n == 6 && !isSmall) {
                    if (i % 3 == 0) angle += shiftSign * shiftAngle
                    if (i % 3 == 1) angle -= shiftSign * shiftAngle
                }
    
                angles.push(angle)
            }
    
            return angles
        }

        generateInnerRing(difficulty, radius) {
            var n = 2
            if (!radius) radius = 200
            if (difficulty == 2) n = Math.floor(Math.random() * 2) + 2
            if (difficulty == 3) n = 4
    
            n += Math.round(Math.random() * 2)
    
            var elements = []
            var angles = this.generateAngleArrangement(n, true, difficulty < 3)
    
            for (var i = 0; i < n; i++) {
                var isBall = Math.random() >= 0.5
    
                if (isBall || (!isBall && i == 0)) {
                    elements.push(
                        new RingBall(angles[i], radius, 50)
                    )
    
                    if (Math.random() >= 0.7 && difficulty > 1 && i > 0) {
                        elements.push(
                            new RingBall(
                                angles[i] + 0.08, radius, 20
                            ),
                            new RingBall(
                                angles[i] - 0.08, radius, 20
                            )
                        )
    
                    }
                } else if (!isBall && i > 0) {
                    var angleStart = angles[i]
                    var angleLength = angles[(i + 1) % angles.length] - angleStart
                    if (angleLength < 0) angleLength += 1
    
                    elements.push(
                        new RingBar(
                            angleStart, angleLength, radius, 10
                        )
                    )
    
                    if (Math.random() >= 0.5) {
                        elements.push(
                            new RingBall(
                                angleStart, radius, 30
                            ),
                            new RingBall(
                                angleStart + angleLength, radius, 30
                            )
                        )
                    }
                }
            }
    
            return elements
        }

        generateMiddleRing(difficulty) {
            if (difficulty == 1) return []
            var n = (difficulty - 1) * 2
            if (difficulty == 3 && Math.random() >= 0.6) n = 6
    
            var angles = this.generateAngleArrangement(n)
            var elements = []
    
            for (var i = 0; i < n / 2; i++) {
                var angleStart = angles[2 * i]
                var angleLength = angles[2 * i + 1] - angleStart
    
                if (difficulty == 3 && Math.random() >= 0.5) {
                    elements.push(
                        new RingMarqueeBar(angleStart, angleLength, 300, 10, 1)
                    )
                } else {
                    elements.push(
                        new RingBar(angleStart, angleLength, 300, 10)
                    )
                }
            }
    
            return elements
        }

        generateDeniseRing(difficulty, radius) {
            if (difficulty == 1) return []
            var n = (difficulty - 1) * 2
            if (difficulty == 3 && Math.random() >= 0.6) n = 6
            if (difficulty == 4) n = Math.floor(Math.random() * 2)*4 + 4
    
            var angles = this.generateAngleArrangement(n)
            var elements = []
    
            for (var i = 0; i < n / 2; i++) {
                var angleStart = angles[2 * i]
                var angleLength = angles[2 * i + 1] - angleStart
    
                if (difficulty >= 3 && Math.random() >= 0.5) {
                    elements.push(
                        new RingMarqueeBar(angleStart, angleLength, radius, 2, 1)
                    )
                } else {
                    elements.push(
                        new RingBar(angleStart, angleLength, radius, 2)
                    )
                }
            }

            for (var i = 1; i < n; i += 2) {
                var angleStart = angles[i]
                var angleLength = angles[(i + 1) % n] - angleStart

                var numOfBalls = Math.round(Math.random() * 2 + 1)

                for (var j = 1; j <= (numOfBalls + 1); j++) {
                    elements.push(
                        new RingBall(
                            angleStart + (j/(numOfBalls+2)) * angleLength,
                            radius,
                            4
                        )
                    )
                }
            }
    
            return elements
        }

        generateOuterRing(difficulty) {
            if (difficulty == 1 && Math.random() >= 0.5) return []
            var n = 3 + Math.round(1.2 * difficulty * Math.random())
            var isPulsing = Math.random() >= 0.5 && difficulty > 1
            var willGenerateBars = difficulty > 2
    
            var elements = []
    
            var angles = this.generateAngleArrangement(n)
            angles.forEach((angle, i) => {
                if (isPulsing && i % 2) {
                    elements.push(
                        new RingPulsingBall(angle, 400, 20, 2)
                    )
                } else {
                    elements.push(
                        new RingBall(angle, 400, 20)
                    )
                }
            })
    
            if (willGenerateBars) {
                for (var i = 0; i < n/2; i++) {
                    var angle1 = angles[i * 2]
                    var angle2 = angles[(i * 2 + 1) % angles.length]
                    if (angle2 < angle1) angle2 += 1
    
                    var angleLength = (angle2 - angle1) * (Math.random() * 0.4 + 0.2)
                    var angleStart = (angle1 + angle2) / 2 - angleLength / 2
    
                    elements.push(
                        new RingBar(angleStart, angleLength, 400, 10)
                    )
                }
            }
    
            return elements
        }
    }

    class Game {
        constructor() {
            /**
             * @type {Level}
             */
            this.level = null

            /**
             * @type {Projectile}
             */
            this.bullet = null

            /**
             * @type {Number}
             */
            this.playerAngle = 0

            /**
             * @type {Number}
             */
            this.progressionLevel = 0

            /**
             * @type {Number}
             */
            this.gameTime = 0

            /**
             * @type {Number}
             */
            this.slowTime = 0

            /**
             * @type {Boolean}
             */
            this.isSlow = false

            /**
             * @type {Number[][]}
             */
            this.staticProgression = [
                [1, 0, 0],
                [1, 0, 0],
                [2, 0, 0],
                [2, 0, 0],
                [2, 0, 0],
                [3, 0, 0],
                [3, 0, 1],
                [2, 0, 2],
                [2, 0, 2],
                [2, 0, 2],
                [2, 1, 2],
                [2, 1, 2]
            ]

            /**
             * @type {Number[][]}
             */
            this.loopedProgression = [
                [3, 1, 2],
                [2, 2, 2],
                [2, 2, 2],
                [2, 3, 2],
                [2, 3, 1],
                [2, 2, 2],
                [2, 2, 2],
                [3, 1, 2],
                [2, 1, 2],
                [3, 1, 2],
                [2, 2, 2],
                [2, 2, 2],
                [2, 3, 2],
                [3, 3, 3],
                [2, 2, 2],
                [2, 2, 2],
                [3, 1, 2],
                [2, 1, 2]
            ]
        }

        advance(time) {
            var dTime = time
            if (this.isSlow) dTime /= 2

            this.gameTime += dTime

            this.level.advance(dTime)

            if (this.bullet) {
                if (Math.hypot(this.bullet.x, this.bullet.y) >= 600) {
                    this.bullet = null
                    this.nextLevel()
                }

                var collision = this.level.getCollidingObject(this.bullet)
                if (collision instanceof RingElement) {
                    this.resetProgress()
                    this.bullet = null
                }
            }

            if (this.bullet) 
                this.bullet.advance(dTime)

            this.playerAngle -= dTime * 0.461538461

            document.querySelector("#initSlowDown").textContent = `Slow down for ${Math.round(this.slowTime*10)/10}s`
            document.querySelector("div.slowProgress div").style.width = `${this.slowTime * 10}%`

            if (this.isSlow) {
                this.slowTime = Math.max(0, this.slowTime - time)
                if (this.slowTime == 0) {
                    document.body.classList.remove("slow")
                    this.isSlow = false
                }
            }
        }

        /**
         * 
         * @param {CanvasRenderingContext2D} context
         */
        render(context) {
            context.fillStyle = "#dbb986"
            context.strokeStyle = "#dbb986"

            context.clearRect(
                0, 0,
                context.canvas.width, context.canvas.height
            )

            this.level.render(context)

            context.lineWidth = 1

            context.beginPath()
            context.moveTo(
                20 * Math.cos(2 * Math.PI * this.playerAngle) + context.canvas.width / 2,
                20 * Math.sin(2 * Math.PI * this.playerAngle) + context.canvas.height / 2
            )
            context.lineTo(
                20 * Math.cos(2 * Math.PI * this.playerAngle + Math.PI - 0.8) + context.canvas.width / 2,
                20 * Math.sin(2 * Math.PI * this.playerAngle + Math.PI - 0.8) + context.canvas.height / 2
            )
            context.lineTo(
                10 * Math.cos(2 * Math.PI * this.playerAngle + Math.PI) + context.canvas.width / 2,
                10 * Math.sin(2 * Math.PI * this.playerAngle + Math.PI) + context.canvas.height / 2
            )
            context.lineTo(
                20 * Math.cos(2 * Math.PI * this.playerAngle + Math.PI + 0.8) + context.canvas.width / 2,
                20 * Math.sin(2 * Math.PI * this.playerAngle + Math.PI + 0.8) + context.canvas.height / 2
            )
            context.closePath()

            context.fill()

            if (this.bullet) {
                context.beginPath()

                context.arc(
                    this.bullet.x + context.canvas.width / 2,
                    this.bullet.y + context.canvas.height / 2,
                    10,
                    0, 2 * Math.PI
                )

                context.fillStyle = "#ff523b"
                context.fill()
            }
        }

        shoot() {
            var bullet = new Projectile(
                20 * Math.cos(2 * Math.PI * this.playerAngle),
                20 * Math.sin(2 * Math.PI * this.playerAngle),
                7,
                750 * Math.cos(2 * Math.PI * this.playerAngle),
                750 * Math.sin(2 * Math.PI * this.playerAngle)
            )

            this.bullet = bullet
        }

        getProgression() {
            if (this.progressionLevel < this.staticProgression.length) return this.staticProgression[this.progressionLevel]

            var level = (this.progressionLevel - this.staticProgression.length) % this.loopedProgression.length
            return this.loopedProgression[level]
        }

        start() {
            this.level = Level.create(this.getProgression())
            this.level.advance(this.gameTime)

            document.querySelector("#levelNum").textContent = this.progressionLevel
            this.updateRecord()
            resizeCanvas()
        }

        nextLevel() {
            this.progressionLevel++
            this.slowTime = Math.min(this.slowTime + 0.2, 10)
            this.start()
        }

        resetProgress() {
            this.progressionLevel = 0
            this.slowTime = Math.min(this.slowTime, 0.6)
            this.start()

            document.body.classList.add("hit")
            setTimeout(() => {
                document.body.classList.remove("hit")
            }, 500)
        }

        updateRecord() {
            var record = 0
            if (localStorage.getItem("g4game_record")) record = localStorage.getItem("g4game_record")

            if (this.progressionLevel > record) record = this.progressionLevel
            localStorage.setItem("g4game_record", record)

            document.querySelector("#recordNum").textContent = record
        }
    }

    class GameDeniseMode extends Game {
        /**
         * 
         * @param {CanvasRenderingContext2D} context 
         */
        render(context) {

            context.clearRect(
                0, 0,
                context.canvas.width, context.canvas.height
            )

            //this.level.render(context)
            for (var i = 0; i < this.level.rings.length; i++) {
                let color = i % 2 ? "#67d387" : "#929292"
                context.fillStyle = color
                context.strokeStyle = color
                
                this.level.rings[i].render(context)
            }

            context.lineWidth = 1

            var drawCannon = (radius) => {
                context.beginPath()
                context.moveTo(
                    radius * Math.cos(2 * Math.PI * this.playerAngle) + context.canvas.width / 2,
                    radius * Math.sin(2 * Math.PI * this.playerAngle) + context.canvas.height / 2
                )
                context.lineTo(
                    radius * Math.cos(2 * Math.PI * this.playerAngle + Math.PI - 0.8) + context.canvas.width / 2,
                    radius * Math.sin(2 * Math.PI * this.playerAngle + Math.PI - 0.8) + context.canvas.height / 2
                )
                context.lineTo(
                    (radius / 2) * Math.cos(2 * Math.PI * this.playerAngle + Math.PI) + context.canvas.width / 2,
                    (radius / 2) * Math.sin(2 * Math.PI * this.playerAngle + Math.PI) + context.canvas.height / 2
                )
                context.lineTo(
                    radius * Math.cos(2 * Math.PI * this.playerAngle + Math.PI + 0.8) + context.canvas.width / 2,
                    radius * Math.sin(2 * Math.PI * this.playerAngle + Math.PI + 0.8) + context.canvas.height / 2
                )
                context.closePath()

                context.stroke()
            }

            context.lineWidth = 4
            context.lineJoin = "round"
            drawCannon(20)
            context.setLineDash([5, 8, 10, 6])
            context.strokeStyle = "#929292"
            drawCannon(40)
            context.setLineDash([])

            if (this.bullet) {
                context.beginPath()

                context.arc(
                    this.bullet.x + context.canvas.width / 2,
                    this.bullet.y + context.canvas.height / 2,
                    10,
                    0, 2 * Math.PI
                )

                context.fillStyle = "#67d387"
                context.fill()
            }
        }

        start() {
            this.level = Level.createDenise()
            this.level.advance(this.gameTime)

            document.querySelector("#levelNum").textContent = this.progressionLevel
            this.updateRecord()
            resizeCanvas()
        }
 
        updateRecord() {
            var record = 0
            if (localStorage.getItem("g4game_recordDenise")) record = localStorage.getItem("g4game_recordDenise")

            if (this.progressionLevel > record) record = this.progressionLevel
            localStorage.setItem("g4game_recordDenise", record)

            document.querySelector("#recordNum").textContent = record
        }}

    class GameNormalMode extends Game {}

    class GameEasyMode extends Game {
        constructor() {
            super()
        }

        /**
         * 
         * @param {CanvasRenderingContext2D} context
         */
        render(context) {
            context.fillStyle = "#4c7d45"
            context.strokeStyle = "#4c7d45"

            context.clearRect(
                0, 0,
                context.canvas.width, context.canvas.height
            )

            this.level.render(context)

            context.lineWidth = 1

            var cannonX = context.canvas.width / 2
            var cannonY = context.canvas.height / 2
        
            context.beginPath()
            context.moveTo(
                20 * Math.cos(2 * Math.PI * this.playerAngle) + cannonX,
                20 * Math.sin(2 * Math.PI * this.playerAngle) + cannonY
            )
            context.lineTo(
                24 * Math.cos(2 * Math.PI * this.playerAngle + Math.PI - 0.8) + cannonX,
                24 * Math.sin(2 * Math.PI * this.playerAngle + Math.PI - 0.8) + cannonY
            )
            context.lineTo(
                10 * Math.cos(2 * Math.PI * this.playerAngle + Math.PI) + cannonX,
                10 * Math.sin(2 * Math.PI * this.playerAngle + Math.PI) + cannonY
            )
            context.lineTo(
                24 * Math.cos(2 * Math.PI * this.playerAngle + Math.PI + 0.8) + cannonX,
                24 * Math.sin(2 * Math.PI * this.playerAngle + Math.PI + 0.8) + cannonY
            )
            context.closePath()

            context.fill()

            if (this.bullet) {
                context.beginPath()

                context.arc(
                    this.bullet.x + context.canvas.width / 2,
                    this.bullet.y + context.canvas.height / 2,
                    10,
                    0, 2 * Math.PI
                )

                context.fillStyle = "#e5ff00"
                context.fill()
            }
        }

        shoot() {
            var cannonPos = [0, 0]

            var bullet = new Projectile(
                20 * Math.cos(2 * Math.PI * this.playerAngle) + cannonPos[0],
                20 * Math.sin(2 * Math.PI * this.playerAngle) + cannonPos[1],
                7,
                750 * Math.cos(2 * Math.PI * this.playerAngle),
                750 * Math.sin(2 * Math.PI * this.playerAngle)
            )

            this.bullet = bullet
        }

        

        getProgression() {
            var progression = super.getProgression()
            
            progression[0] = Math.max(progression[0], 2)
            progression[1] = 0
            progression[2] = 0

            return progression
        }
 
        updateRecord() {
            var record = 0
            if (localStorage.getItem("g4game_recordEasy")) record = localStorage.getItem("g4game_recordEasy")

            if (this.progressionLevel > record) record = this.progressionLevel
            localStorage.setItem("g4game_recordEasy", record)

            document.querySelector("#recordNum").textContent = record
        }
    }

    class GameHardMode extends Game {
        constructor() {
            super()
        }

        advance(time) {
            super.advance(time)
        }

        getCannonPosition() {
            return [
                Math.cos(-this.playerAngle * Math.PI) * 40,
                Math.sin(-this.playerAngle * Math.PI) * 40
            ]
        }

        /**
         * 
         * @param {CanvasRenderingContext2D} context
         */
        render(context) {
            context.fillStyle = "#9bd1ba"
            context.strokeStyle = "#9bd1ba"

            context.clearRect(
                0, 0,
                context.canvas.width, context.canvas.height
            )

            this.level.render(context)

            context.lineWidth = 1

            var cannonX = context.canvas.width / 2
            var cannonY = context.canvas.height / 2

            var cannonPos = this.getCannonPosition()
            cannonX += cannonPos[0]
            cannonY += cannonPos[1]
        
            context.beginPath()
            context.moveTo(
                20 * Math.cos(2 * Math.PI * this.playerAngle) + cannonX,
                20 * Math.sin(2 * Math.PI * this.playerAngle) + cannonY
            )
            context.lineTo(
                24 * Math.cos(2 * Math.PI * this.playerAngle + Math.PI - 0.8) + cannonX,
                24 * Math.sin(2 * Math.PI * this.playerAngle + Math.PI - 0.8) + cannonY
            )
            context.lineTo(
                10 * Math.cos(2 * Math.PI * this.playerAngle + Math.PI) + cannonX,
                10 * Math.sin(2 * Math.PI * this.playerAngle + Math.PI) + cannonY
            )
            context.lineTo(
                24 * Math.cos(2 * Math.PI * this.playerAngle + Math.PI + 0.8) + cannonX,
                24 * Math.sin(2 * Math.PI * this.playerAngle + Math.PI + 0.8) + cannonY
            )
            context.closePath()

            context.fill()

            context.beginPath()
            
            context.arc(
                10 * Math.cos(2 * Math.PI * this.playerAngle + Math.PI) + cannonX,
                10 * Math.sin(2 * Math.PI * this.playerAngle + Math.PI) + cannonY,
                6, 0, Math.PI * 2
            )

            context.fillStyle = "#151523"
            context.fill()

            if (this.bullet) {
                context.beginPath()

                context.arc(
                    this.bullet.x + context.canvas.width / 2,
                    this.bullet.y + context.canvas.height / 2,
                    10,
                    0, 2 * Math.PI
                )

                context.fillStyle = "#ffcb3b"
                context.fill()
            }
        }

        shoot() {
            var cannonPos = this.getCannonPosition()

            var bullet = new Projectile(
                20 * Math.cos(2 * Math.PI * this.playerAngle) + cannonPos[0],
                20 * Math.sin(2 * Math.PI * this.playerAngle) + cannonPos[1],
                7,
                750 * Math.cos(2 * Math.PI * this.playerAngle),
                750 * Math.sin(2 * Math.PI * this.playerAngle)
            )

            this.bullet = bullet
        }

        getProgression() {
            if (this.progressionLevel < this.staticProgression.length) return this.staticProgression[this.progressionLevel].map(x => x ? 3 : 0)

            var level = (this.progressionLevel - this.staticProgression.length) % this.loopedProgression.length
            return this.loopedProgression[level].map(x => x ? 3 : 0)
        }
 
        updateRecord() {
            var record = 0
            if (localStorage.getItem("g4game_recordHard")) record = localStorage.getItem("g4game_recordHard")

            if (this.progressionLevel > record) record = this.progressionLevel
            localStorage.setItem("g4game_recordHard", record)

            document.querySelector("#recordNum").textContent = record
        }
    }

    class GameHellMode extends Game {
        getCannonPosition() {
            return [
                Math.cos(-this.playerAngle * Math.PI) * 40,
                Math.sin(-this.playerAngle * Math.PI) * 40
            ]
        }

        /**
         * 
         * @param {CanvasRenderingContext2D} context
         */
        render(context) {
            context.fillStyle = "#000000"
            context.strokeStyle = "#000000"

            context.clearRect(
                0, 0,
                context.canvas.width, context.canvas.height
            )

            this.level.render(context)

            context.lineWidth = 1

            var cannonX = context.canvas.width / 2
            var cannonY = context.canvas.height / 2

            var cannonPos = this.getCannonPosition()
            cannonX += cannonPos[0]
            cannonY += cannonPos[1]
        
            context.beginPath()
            context.moveTo(
                20 * Math.cos(2 * Math.PI * this.playerAngle) + cannonX,
                20 * Math.sin(2 * Math.PI * this.playerAngle) + cannonY
            )
            context.lineTo(
                24 * Math.cos(2 * Math.PI * this.playerAngle + Math.PI - 0.8) + cannonX,
                24 * Math.sin(2 * Math.PI * this.playerAngle + Math.PI - 0.8) + cannonY
            )
            context.lineTo(
                10 * Math.cos(2 * Math.PI * this.playerAngle + Math.PI) + cannonX,
                10 * Math.sin(2 * Math.PI * this.playerAngle + Math.PI) + cannonY
            )
            context.lineTo(
                24 * Math.cos(2 * Math.PI * this.playerAngle + Math.PI + 0.8) + cannonX,
                24 * Math.sin(2 * Math.PI * this.playerAngle + Math.PI + 0.8) + cannonY
            )
            context.closePath()

            context.fill()

            context.beginPath()
            context.arc(
                cannonX, cannonY, 30, 2 * Math.PI * this.playerAngle + 0.8, 2 * Math.PI * this.playerAngle + 2 * Math.PI - 0.8
            )

            context.lineWidth = 4
            context.stroke()

            context.beginPath()
            
            context.arc(
                10 * Math.cos(2 * Math.PI * this.playerAngle + Math.PI) + cannonX,
                10 * Math.sin(2 * Math.PI * this.playerAngle + Math.PI) + cannonY,
                6, 0, Math.PI * 2
            )


            context.fillStyle = "#780000"
            context.fill()

            if (this.bullet) {
                context.beginPath()

                context.arc(
                    this.bullet.x + context.canvas.width / 2,
                    this.bullet.y + context.canvas.height / 2,
                    10,
                    0, 2 * Math.PI
                )

                context.fillStyle = "#ffa600"
                context.fill()
            }
        }

        shoot() {
            var cannonPos = this.getCannonPosition()

            var bullet = new Projectile(
                20 * Math.cos(2 * Math.PI * this.playerAngle) + cannonPos[0],
                20 * Math.sin(2 * Math.PI * this.playerAngle) + cannonPos[1],
                7,
                750 * Math.cos(2 * Math.PI * this.playerAngle),
                750 * Math.sin(2 * Math.PI * this.playerAngle)
            )

            this.bullet = bullet
        }

        start() {
            this.level = Level.createHell()
            this.level.advance(this.gameTime)

            document.querySelector("#levelNum").textContent = this.progressionLevel
            this.updateRecord()
            resizeCanvas()
        }
 
        updateRecord() {
            var record = 0
            if (localStorage.getItem("g4game_recordHell")) record = localStorage.getItem("g4game_recordHell")

            if (this.progressionLevel > record) record = this.progressionLevel
            localStorage.setItem("g4game_recordHell", record)

            document.querySelector("#recordNum").textContent = record
        }
    }

    class GameHadesMode extends Game {
        getCannonPosition() {
            return [
                Math.cos(-this.playerAngle * Math.PI) * 200,
                Math.sin(-this.playerAngle * Math.PI) * 200
            ]
        }

        /**
         * 
         * @param {CanvasRenderingContext2D} context
         */
        render(context) {
            context.fillStyle = "#000"
            context.fillRect(
                0, 0,
                context.canvas.width, context.canvas.height
            )

            context.fillStyle = "#302f35"
            context.strokeStyle = "#302f35"
            this.level.render(context)

            context.lineWidth = 1

            var cannonX = context.canvas.width / 2
            var cannonY = context.canvas.height / 2

            var cannonPos = this.getCannonPosition()
            cannonX += cannonPos[0]
            cannonY += cannonPos[1]

            if (!legacyMode) {
                var spotlight = context.createRadialGradient(
                    cannonX, cannonY, 900, cannonX, cannonY, 0
                )
                spotlight.addColorStop(0, "#000")
                spotlight.addColorStop(1, "#fff")

                context.globalCompositeOperation = "multiply"
                context.fillStyle = spotlight
                context.fillRect(
                    0, 0,
                    context.canvas.width, context.canvas.height
                )

                var glow = context.createRadialGradient(
                    cannonX, cannonY, 100, cannonX, cannonY, 0
                )
                glow.addColorStop(0, "#000")
                glow.addColorStop(0.6, "#111")
                glow.addColorStop(1, "#222")

                context.globalCompositeOperation = "screen"
                context.fillStyle = glow
                context.fillRect(
                    0, 0,
                    context.canvas.width, context.canvas.height
                )

                context.globalCompositeOperation = "source-over"
            }
        
            context.beginPath()
            context.moveTo(
                20 * Math.cos(2 * Math.PI * this.playerAngle) + cannonX,
                20 * Math.sin(2 * Math.PI * this.playerAngle) + cannonY
            )
            context.lineTo(
                24 * Math.cos(2 * Math.PI * this.playerAngle + Math.PI - 0.6) + cannonX,
                24 * Math.sin(2 * Math.PI * this.playerAngle + Math.PI - 0.6) + cannonY
            )
            context.lineTo(
                24 * Math.cos(2 * Math.PI * this.playerAngle + Math.PI + 0.6) + cannonX,
                24 * Math.sin(2 * Math.PI * this.playerAngle + Math.PI + 0.6) + cannonY
            )
            context.closePath()

            context.fillStyle = "#fff"
            context.fill()

            if (this.bullet) {
                context.beginPath()

                context.arc(
                    this.bullet.x + context.canvas.width / 2,
                    this.bullet.y + context.canvas.height / 2,
                    10,
                    0, 2 * Math.PI
                )

                context.fillStyle = "#227892"
                context.fill()
            }
        }

        shoot() {
            var cannonPos = this.getCannonPosition()

            var bullet = new Projectile(
                20 * Math.cos(2 * Math.PI * this.playerAngle) + cannonPos[0],
                20 * Math.sin(2 * Math.PI * this.playerAngle) + cannonPos[1],
                7,
                750 * Math.cos(2 * Math.PI * this.playerAngle),
                750 * Math.sin(2 * Math.PI * this.playerAngle)
            )

            this.bullet = bullet
        }

        start() {
            this.level = Level.createHades()
            this.level.advance(this.gameTime)

            document.querySelector("#levelNum").textContent = this.progressionLevel
            this.updateRecord()
            resizeCanvas()
        }
 
        updateRecord() {
            var record = 0
            if (localStorage.getItem("g4game_recordHades")) record = localStorage.getItem("g4game_recordHades")

            if (this.progressionLevel > record) record = this.progressionLevel
            localStorage.setItem("g4game_recordHades", record)

            document.querySelector("#recordNum").textContent = record
        }
    }

    var game = new GameNormalMode()

    var gameCanvas = document.querySelector("canvas")
    var gameCanvasContext = gameCanvas.getContext("2d")


    game.start()
    game.updateRecord()

    setInterval(() => {
        game.advance(1/90)
    }, 1000/90)

    function render() {
        requestAnimationFrame(render)
        game.render(gameCanvasContext)
    }

    addEventListener("keydown", (e) => {
        console.log(e)
        if (e.code == "Space" && !game.bullet)
            game.shoot()
        else if (e.code == "KeyS" && !game.isSlow && game.slowTime && !(game instanceof GameHellMode) && !(game instanceof GameHadesMode)) {
            game.isSlow = true
            document.body.classList.add("slow")
        }
    })
    gameCanvas.addEventListener("click", () => {
        if (!game.bullet) game.shoot()
    })

    function resizeCanvas() {
        var minSize = Math.min(innerHeight - 64, innerWidth) - 24

        if (!game.level.rings[2].elements.length) {
            minSize += 150

            if (!game.level.rings[1].elements.length) {
                minSize += 80
            }
        }

        if (minSize < 900)
            gameCanvas.style.transform = `translate(-50%, -50%) scale(${minSize/900})`
        else
            gameCanvas.style.transform = `translate(-50%, -50%) scale(1)`
    }

    resizeCanvas()
    addEventListener("resize", () => resizeCanvas())

    var audio = document.querySelector("audio")
    audio.load()

    audio.addEventListener("canplaythrough", () => {
        document.querySelector("#muteMusic").style.display = "initial"
    })

    document.querySelector("#muteMusic").addEventListener("click", function() {
        this.classList.toggle("checked")

        if (this.classList.contains("checked")) {
            this.textContent = "Unmute"
            audio.pause()
        } else {
            this.textContent = "Mute"
            audio.play()
        }
    })

    // document.querySelector("#switchModes").addEventListener("click", function() {
        // if (game instanceof GameHardMode) {
        //     game = new Game()
        //     game.start()
        //     game.updateRecord()

        //     document.body.classList.remove("hard")

        //     this.textContent = "Hard mode"
        // } else {
        //     game = new GameHardMode()
        //     game.start()
        //     game.updateRecord()

        //     document.body.classList.add("hard")

        //     this.textContent = "Normal mode"
        // }
    // })

    document.querySelector("#modeEasy").addEventListener("click", function() {
        if (game instanceof GameEasyMode) return

        game = new GameEasyMode()
        game.start()
        game.updateRecord()

        document.body.classList.add("easy")
        document.body.classList.remove("hard")
        document.body.classList.remove("hell")
        document.body.classList.remove("hades")
        document.body.classList.remove("denise")

        document.querySelector("div#modeSwitches button.checked").classList.remove("checked")
        this.classList.add("checked")
    })

    document.querySelector("#modeNormal").addEventListener("click", function() {
        if (game instanceof GameNormalMode) return

        game = new GameNormalMode()
        game.start()
        game.updateRecord()

        document.body.classList.remove("easy")
        document.body.classList.remove("hard")
        document.body.classList.remove("hell")
        document.body.classList.remove("hades")
        document.body.classList.remove("denise")

        document.querySelector("div#modeSwitches button.checked").classList.remove("checked")
        this.classList.add("checked")
    })

    document.querySelector("#modeHard").addEventListener("click", function() {
        if (game instanceof GameHardMode) return

        game = new GameHardMode()
        game.start()
        game.updateRecord()

        document.body.classList.remove("easy")
        document.body.classList.add("hard")
        document.body.classList.remove("hell")
        document.body.classList.remove("hades")
        document.body.classList.remove("denise")

        document.querySelector("div#modeSwitches button.checked").classList.remove("checked")
        this.classList.add("checked")
    })

    document.querySelector("#modeHell").addEventListener("click", function() {
        if (game instanceof GameHellMode) return

        game = new GameHellMode()
        game.start()
        game.updateRecord()

        document.body.classList.remove("easy")
        document.body.classList.remove("hard")
        document.body.classList.add("hell")
        document.body.classList.remove("hades")
        document.body.classList.remove("denise")

        document.querySelector("div#modeSwitches button.checked").classList.remove("checked")
        this.classList.add("checked")
    })

    document.querySelector("#modeHades").addEventListener("click", function() {
        if (game instanceof GameHadesMode) return

        game = new GameHadesMode()
        game.start()
        game.updateRecord()

        document.body.classList.remove("easy")
        document.body.classList.remove("hard")
        document.body.classList.remove("hell")
        document.body.classList.add("hades")
        document.body.classList.remove("denise")

        document.querySelector("div#modeSwitches button.checked").classList.remove("checked")
        this.classList.add("checked")
    })

    document.querySelector("#modeDenise").addEventListener("click", function() {
        if (game instanceof GameDeniseMode) return

        game = new GameDeniseMode()
        game.start()
        game.updateRecord()

        document.body.classList.remove("easy")
        document.body.classList.remove("hard")
        document.body.classList.remove("hell")
        document.body.classList.remove("hades")
        document.body.classList.add("denise")

        document.querySelector("div#modeSwitches button.checked").classList.remove("checked")
        this.classList.add("checked")
    })

    document.querySelector("#initSlowDown").addEventListener("click", () => {
        if (!game.isSlow && game.slowTime) {
            game.isSlow = true
            document.body.classList.add("slow")

        }
    })

    document.querySelector("#levelNum").addEventListener("click", () => {
        legacyMode = !legacyMode
    })

    render()
})()