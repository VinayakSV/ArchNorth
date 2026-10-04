import OwnerRoute from '../components/common/OwnerRoute';
import ProgressTracker from './ProgressTracker';

// The owner-only /progress page. Firebase is imported through OwnerRoute, so it lives in this page's
// code-split chunk and never starts (or writes to browser storage) for visitors who don't open it.
export default function PrivateProgress() {
  return (
    <OwnerRoute>
      <ProgressTracker />
    </OwnerRoute>
  );
}
