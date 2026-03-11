export const showRewardedAd = (): Promise<boolean> => {
  return new Promise((resolve) => {
    // Create a full-screen overlay to simulate a rewarded video ad
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.color = '#fff';
    overlay.style.fontFamily = 'sans-serif';

    const text = document.createElement('div');
    text.innerText = 'Advertisement Playing...';
    text.style.fontSize = '24px';
    text.style.marginBottom = '20px';

    const countdown = document.createElement('div');
    countdown.style.fontSize = '48px';
    countdown.style.fontWeight = 'bold';
    
    overlay.appendChild(text);
    overlay.appendChild(countdown);
    document.body.appendChild(overlay);

    let timeLeft = 3;
    countdown.innerText = timeLeft.toString();

    const interval = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft > 0) {
        countdown.innerText = timeLeft.toString();
      } else {
        clearInterval(interval);
        document.body.removeChild(overlay);
        resolve(true); // Ad completed successfully
      }
    }, 1000);
  });
};
