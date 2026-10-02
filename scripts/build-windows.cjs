const path = require('node:path');
const { build, Platform, Arch } = require('electron-builder');

// electron-builder already uses this reader on macOS to extract the NSIS
// uninstaller without executing a Windows process. Use the same reader on
// Linux, where a 32-bit Wine installation is not always available.
if (process.platform === 'linux') {
  const { WineVmManager } = require('app-builder-lib/out/vm/WineVm');
  const { UninstallerReader } = require('app-builder-lib/out/targets/nsis/nsisUtil');
  const original = WineVmManager.prototype.exec;
  WineVmManager.prototype.exec = async function (file, args, options, ...rest) {
    if (options?.env?.__COMPAT_LAYER === 'RunAsInvoker' && args.length === 0 && file.toLowerCase().endsWith('.exe')) {
      const destination = path.join(path.dirname(file), `${path.basename(file, 'exe')}__uninstaller.exe`);
      await UninstallerReader.exec(file, destination);
      return '';
    }
    return original.call(this, file, args, options, ...rest);
  };
}
build({ targets: Platform.WINDOWS.createTarget(['nsis', 'zip'], Arch.x64) }).catch(error => { console.error(error); process.exitCode = 1; });
