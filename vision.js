// Small 3 → 6 → 1 network trained on 102522 synthetic pixel examples.
const visionHidden = [[-1.083406,0.553272,0.220071,2.648371],[-0.278157,2.390762,-1.944374,-1.771718],[1.411738,0.725511,0.325661,2.378081],[3.378539,0.24142,0.243615,4.396981],[-0.344572,-0.298297,-1.534058,-2.515311],[-0.464388,-0.671265,-0.254768,-1.674196]];
const visionOutput = [0.057647,2.463274,-0.584145,0.563846,2.468249,-0.975254,-0.576529];

function visionPredict(features) {
  const inputs = features.map(value => (value - .5) * 3);
  const activations = visionHidden.map(weights => {
    const activation = inputs.reduce((sum, input, index) => sum + input * weights[index + 1], weights[0]);
    return Math.tanh(activation);
  });
  const score = activations.reduce((sum, value, index) => sum + value * visionOutput[index + 1], visionOutput[0]);
  return score >= 0;
}
