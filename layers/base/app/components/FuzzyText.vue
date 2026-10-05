<template>
	<canvas ref="canvasRef" :class="className" />
</template>

<script lang="ts" setup>
/**
 * Porta Vue do Fuzzy Text (React Bits)
 * https://reactbits.dev/text-animations/fuzzy-text
 */
const props = withDefaults(
	defineProps<{
		text?: string;
		fontSize?: number | string;
		fontWeight?: string | number;
		fontFamily?: string;
		color?: string;
		enableHover?: boolean;
		baseIntensity?: number;
		hoverIntensity?: number;
		fuzzRange?: number;
		fps?: number;
		direction?: "horizontal" | "vertical" | "both";
		transitionDuration?: number;
		clickEffect?: boolean;
		glitchMode?: boolean;
		glitchInterval?: number;
		glitchDuration?: number;
		gradient?: string[] | null;
		letterSpacing?: number;
		className?: string;
	}>(),
	{
		text: "404",
		fontSize: "clamp(2rem, 8vw, 8rem)",
		fontWeight: 900,
		fontFamily: "inherit",
		color: "#fff",
		enableHover: true,
		baseIntensity: 0.2,
		hoverIntensity: 0.5,
		fuzzRange: 30,
		fps: 60,
		direction: "horizontal",
		transitionDuration: 0,
		clickEffect: false,
		glitchMode: false,
		glitchInterval: 2000,
		glitchDuration: 200,
		gradient: null,
		letterSpacing: 0,
		className: "",
	},
);

type CanvasWithCleanup = HTMLCanvasElement & {
	cleanupFuzzyText?: () => void;
};

const canvasRef = ref<CanvasWithCleanup | null>(null);
let stopInit: (() => void) | null = null;

function start() {
	stopInit?.();
	const canvas = canvasRef.value;
	if (!canvas) return;

	let animationFrameId = 0;
	let isCancelled = false;
	let glitchTimeoutId: ReturnType<typeof setTimeout> | undefined;
	let glitchEndTimeoutId: ReturnType<typeof setTimeout> | undefined;
	let clickTimeoutId: ReturnType<typeof setTimeout> | undefined;

	const init = async () => {
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const computedFontFamily =
			props.fontFamily === "inherit"
				? window.getComputedStyle(canvas).fontFamily || "sans-serif"
				: props.fontFamily;

		const fontSizeStr =
			typeof props.fontSize === "number"
				? `${props.fontSize}px`
				: props.fontSize;
		const fontString = `${props.fontWeight} ${fontSizeStr} ${computedFontFamily}`;

		try {
			await document.fonts.load(fontString);
		} catch {
			await document.fonts.ready;
		}
		if (isCancelled) return;

		let numericFontSize: number;
		if (typeof props.fontSize === "number") {
			numericFontSize = props.fontSize;
		} else {
			const temp = document.createElement("span");
			temp.style.fontSize = props.fontSize;
			document.body.appendChild(temp);
			numericFontSize = parseFloat(window.getComputedStyle(temp).fontSize);
			document.body.removeChild(temp);
		}

		const text = props.text;

		const offscreen = document.createElement("canvas");
		const offCtx = offscreen.getContext("2d");
		if (!offCtx) return;

		offCtx.font = `${props.fontWeight} ${fontSizeStr} ${computedFontFamily}`;
		offCtx.textBaseline = "alphabetic";

		let totalWidth = 0;
		if (props.letterSpacing !== 0) {
			for (const char of text) {
				totalWidth += offCtx.measureText(char).width + props.letterSpacing;
			}
			totalWidth -= props.letterSpacing;
		} else {
			totalWidth = offCtx.measureText(text).width;
		}

		const metrics = offCtx.measureText(text);
		const actualLeft = metrics.actualBoundingBoxLeft ?? 0;
		const actualRight =
			props.letterSpacing !== 0
				? totalWidth
				: (metrics.actualBoundingBoxRight ?? metrics.width);
		const actualAscent = metrics.actualBoundingBoxAscent ?? numericFontSize;
		const actualDescent =
			metrics.actualBoundingBoxDescent ?? numericFontSize * 0.2;

		const textBoundingWidth = Math.ceil(
			props.letterSpacing !== 0 ? totalWidth : actualLeft + actualRight,
		);
		const tightHeight = Math.ceil(actualAscent + actualDescent);

		const extraWidthBuffer = 10;
		const offscreenWidth = textBoundingWidth + extraWidthBuffer;

		offscreen.width = offscreenWidth;
		offscreen.height = tightHeight;

		const xOffset = extraWidthBuffer / 2;
		offCtx.font = `${props.fontWeight} ${fontSizeStr} ${computedFontFamily}`;
		offCtx.textBaseline = "alphabetic";

		if (props.gradient && props.gradient.length >= 2) {
			const grad = offCtx.createLinearGradient(0, 0, offscreenWidth, 0);
			props.gradient.forEach((c, i) =>
				grad.addColorStop(i / (props.gradient!.length - 1), c),
			);
			offCtx.fillStyle = grad;
		} else {
			offCtx.fillStyle = props.color;
		}

		if (props.letterSpacing !== 0) {
			let xPos = xOffset;
			for (const char of text) {
				offCtx.fillText(char, xPos, actualAscent);
				xPos += offCtx.measureText(char).width + props.letterSpacing;
			}
		} else {
			offCtx.fillText(text, xOffset - actualLeft, actualAscent);
		}

		const horizontalMargin = props.fuzzRange + 20;
		const verticalMargin =
			props.direction === "vertical" || props.direction === "both"
				? props.fuzzRange + 10
				: 0;
		canvas.width = offscreenWidth + horizontalMargin * 2;
		canvas.height = tightHeight + verticalMargin * 2;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.translate(horizontalMargin, verticalMargin);

		const interactiveLeft = horizontalMargin + xOffset;
		const interactiveTop = verticalMargin;
		const interactiveRight = interactiveLeft + textBoundingWidth;
		const interactiveBottom = interactiveTop + tightHeight;

		let isHovering = false;
		let isClicking = false;
		let isGlitching = false;
		let currentIntensity = props.baseIntensity;
		let targetIntensity = props.baseIntensity;
		let lastFrameTime = 0;
		const frameDuration = 1000 / props.fps;

		const startGlitchLoop = () => {
			if (!props.glitchMode || isCancelled) return;
			glitchTimeoutId = setTimeout(() => {
				if (isCancelled) return;
				isGlitching = true;
				glitchEndTimeoutId = setTimeout(() => {
					isGlitching = false;
					startGlitchLoop();
				}, props.glitchDuration);
			}, props.glitchInterval);
		};

		if (props.glitchMode) startGlitchLoop();

		const run = (timestamp: number) => {
			if (isCancelled) return;

			if (timestamp - lastFrameTime < frameDuration) {
				animationFrameId = window.requestAnimationFrame(run);
				return;
			}
			lastFrameTime = timestamp;

			ctx.clearRect(
				-props.fuzzRange - 20,
				-props.fuzzRange - 10,
				offscreenWidth + 2 * (props.fuzzRange + 20),
				tightHeight + 2 * (props.fuzzRange + 10),
			);

			if (isClicking || isGlitching) {
				targetIntensity = 1;
			} else if (isHovering) {
				targetIntensity = props.hoverIntensity;
			} else {
				targetIntensity = props.baseIntensity;
			}

			if (props.transitionDuration > 0) {
				const step = 1 / (props.transitionDuration / frameDuration);
				if (currentIntensity < targetIntensity) {
					currentIntensity = Math.min(currentIntensity + step, targetIntensity);
				} else if (currentIntensity > targetIntensity) {
					currentIntensity = Math.max(currentIntensity - step, targetIntensity);
				}
			} else {
				currentIntensity = targetIntensity;
			}

			for (let j = 0; j < tightHeight; j++) {
				let dx = 0;
				let dy = 0;
				if (props.direction === "horizontal" || props.direction === "both") {
					dx = Math.floor(
						currentIntensity * (Math.random() - 0.5) * props.fuzzRange,
					);
				}
				if (props.direction === "vertical" || props.direction === "both") {
					dy = Math.floor(
						currentIntensity * (Math.random() - 0.5) * props.fuzzRange * 0.5,
					);
				}
				ctx.drawImage(
					offscreen,
					0,
					j,
					offscreenWidth,
					1,
					dx,
					j + dy,
					offscreenWidth,
					1,
				);
			}
			animationFrameId = window.requestAnimationFrame(run);
		};

		animationFrameId = window.requestAnimationFrame(run);

		const isInsideTextArea = (x: number, y: number) =>
			x >= interactiveLeft &&
			x <= interactiveRight &&
			y >= interactiveTop &&
			y <= interactiveBottom;

		const handleMouseMove = (e: MouseEvent) => {
			if (!props.enableHover) return;
			const rect = canvas.getBoundingClientRect();
			isHovering = isInsideTextArea(e.clientX - rect.left, e.clientY - rect.top);
		};

		const handleMouseLeave = () => {
			isHovering = false;
		};

		const handleClick = () => {
			if (!props.clickEffect) return;
			isClicking = true;
			clearTimeout(clickTimeoutId);
			clickTimeoutId = setTimeout(() => {
				isClicking = false;
			}, 150);
		};

		const handleTouchMove = (e: TouchEvent) => {
			if (!props.enableHover) return;
			e.preventDefault();
			const rect = canvas.getBoundingClientRect();
			const touch = e.touches[0];
			if (!touch) return;
			isHovering = isInsideTextArea(
				touch.clientX - rect.left,
				touch.clientY - rect.top,
			);
		};

		const handleTouchEnd = () => {
			isHovering = false;
		};

		if (props.enableHover) {
			canvas.addEventListener("mousemove", handleMouseMove);
			canvas.addEventListener("mouseleave", handleMouseLeave);
			canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
			canvas.addEventListener("touchend", handleTouchEnd);
		}

		if (props.clickEffect) {
			canvas.addEventListener("click", handleClick);
		}

		canvas.cleanupFuzzyText = () => {
			window.cancelAnimationFrame(animationFrameId);
			clearTimeout(glitchTimeoutId);
			clearTimeout(glitchEndTimeoutId);
			clearTimeout(clickTimeoutId);
			if (props.enableHover) {
				canvas.removeEventListener("mousemove", handleMouseMove);
				canvas.removeEventListener("mouseleave", handleMouseLeave);
				canvas.removeEventListener("touchmove", handleTouchMove);
				canvas.removeEventListener("touchend", handleTouchEnd);
			}
			if (props.clickEffect) {
				canvas.removeEventListener("click", handleClick);
			}
		};
	};

	void init();

	stopInit = () => {
		isCancelled = true;
		window.cancelAnimationFrame(animationFrameId);
		clearTimeout(glitchTimeoutId);
		clearTimeout(glitchEndTimeoutId);
		clearTimeout(clickTimeoutId);
		canvas.cleanupFuzzyText?.();
		stopInit = null;
	};
}

onMounted(async () => {
	await nextTick();
	start();
});

watch(
	() =>
		[
			props.text,
			props.fontSize,
			props.fontWeight,
			props.fontFamily,
			props.color,
			props.enableHover,
			props.baseIntensity,
			props.hoverIntensity,
			props.fuzzRange,
			props.fps,
			props.direction,
			props.transitionDuration,
			props.clickEffect,
			props.glitchMode,
			props.glitchInterval,
			props.glitchDuration,
			props.gradient,
			props.letterSpacing,
		] as const,
	async () => {
		await nextTick();
		start();
	},
);

onBeforeUnmount(() => {
	stopInit?.();
});
</script>
