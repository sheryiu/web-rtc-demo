import { isPlatformServer } from '@angular/common';
import { Component, effect, inject, isDevMode, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import QRCode from 'qrcode';
import { MultiplayerService } from '../core/multiplayer.service';
import { RtcManagerService } from '../core/rtc-manager.service';

@Component({
  selector: 'app-host-game',
  standalone: true,
  imports: [
    RouterLink,
  ],
  template: `
  <div class="absolute inset-0 backdrop-blur-sm bg-black/10 flex items-center justify-center">
    <div class="flex items-center justify-center flex-col max-w-screen-md min-w-60 w-10/12 bg-white rounded-2xl p-6 gap-4 relative before:absolute before:inset-1 before:rounded-xl before:border-2 before:border-black/50 before:pointer-events-none">
      <p class="text-xl font-medium">Send this URL to your friend</p>
      <p class="-my-2">Click URL to copy</p>
      @if (url()) {
        <p class="truncate w-full border border-black rounded-md p-1 select-all" (click)="onCopyUrl()">{{ url() }}</p>
        @if (qrCodeReader() == null) {
          <div class="flex flex-row gap-4 overflow-x-auto overflow-y-hidden w-full">
            @for (segment of urlSegmentsDataUrl(); track segment) {
              <div class="flex flex-col gap-2 items-center w-64 flex-none">
                <img class="size-64" [src]="segment" alt="QR Code Segment">
                <span class="text-3xl font-bold">{{ $index + 1 }}</span>
              </div>
            }
          </div>
        }
      } @else {
        <p class="truncate w-full border border-black rounded-md p-1 text-stone-800">Loading...</p>
      }
      <p class="text-xl font-medium">Then, paste code from your friend</p>
      <input class="rounded-md outline-none w-full px-2 py-1 border border-black" (input)="onCodeInput($event)" placeholder="Paste here">
      <p class="text-xl font-medium">Or, scan the QR codes from your friend</p>
      @if (qrCodeReader() == null) {
        <button type="button" class="rounded-md outline-none font-medium px-4 py-1 bg-black/10 border border-black" (click)="openCamera()">Open camera</button>
      } @else {
        <button type="button" class="rounded-md outline-none font-medium px-4 py-1 bg-black/10 border border-black" (click)="stopCamera()">Close camera</button>
      }
      <div id="qrCodeWebcam" class="w-4/5">
      </div>
      @if (scannedCodes().length > 0) {
        <p class="text-lg font-medium">Scanned Codes:</p>
        <div class="flex flex-col gap-2 max-h-48 overflow-y-auto w-full">
          @for (code of scannedCodes(); track code) {
            <p class="truncate w-full border border-black rounded-md p-1 bg-black/10 flex-none"><span class="text-black/70 select-none">{{ $index + 1 }}: </span>{{ code }}</p>
          }
        </div>
      }
      <div class="w-full h-0.5 bg-gradient-to-r from-transparent via-black to-transparent"></div>
      <button [routerLink]="['../']">Back</button>
    </div>
  </div>
  `,
})
export class HostGameComponent {
  private rtcManager = inject(RtcManagerService);
  private multiplayer = inject(MultiplayerService);
  url = signal<string>('');
  urlSegmentsDataUrl = signal<string[]>([]);
  private router = inject(Router);
  qrCodeReader = signal<Html5Qrcode | null>(null);
  scannedCodes = signal<string[]>([]);

  constructor() {
    if (isPlatformServer(inject(PLATFORM_ID))) return;
    this.rtcManager.initialize().then((data) => {
      return RtcManagerService.formatAsUrl(data)
    }).then(formatted => {
      this.url.set(`${ location.origin }${ isDevMode() ? '' : '/web-rtc-demo' }/join-game?code=${ formatted }`);
      return formatted.match(/.{1,128}/g) ?? [];
    }).then(segments => {
      return Promise.all(segments.map(segment => {
        return QRCode.toDataURL(segment)
      }))
    }).then(qrCodes => {
      this.urlSegmentsDataUrl.set(qrCodes);
    })
    this.rtcManager.onChannelOpen.pipe(
      takeUntilDestroyed(),
    ).subscribe(isOpen => {
      if (isOpen) {
        this.multiplayer.startGameAsHost();
        this.router.navigate(['../'], { replaceUrl: true })
      }
    })
    effect(() => {
      const scanned = this.scannedCodes();
      const zippedData = scanned.join('')
      try {
        const [iceCandidates, answer] = RtcManagerService.parseFromUrl(zippedData);
        this.rtcManager.setAnswer(answer);
        this.rtcManager.addIceCandidates(iceCandidates);
      } catch (e) {
        console.error(e);
      }
    })
  }

  onCopyUrl() {
    navigator.clipboard.writeText(this.url())
  }

  onCodeInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    try {
      const [iceCandidates, answer] = RtcManagerService.parseFromUrl(input.value);
      this.rtcManager.setAnswer(answer);
      this.rtcManager.addIceCandidates(iceCandidates);
    } catch (e) {}
  }

  openCamera() {
    this.qrCodeReader.set(new Html5Qrcode("qrCodeWebcam", { formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ], verbose: false }));
    this.qrCodeReader()!.start({ facingMode: 'user' }, { fps: 30 }, (code) => {
      const scanned = this.scannedCodes();
      if (scanned.includes(code)) return;
      this.scannedCodes.set(scanned.toSpliced(scanned.length, 0, code));
    }, (err) => {
      if (err.includes('NotFoundException')) return;
      console.error(err);
    })
  }

  stopCamera() {
    this.qrCodeReader()?.stop().then(() => {
      this.qrCodeReader()?.clear();
      this.qrCodeReader.set(null);
      this.scannedCodes.set([]);
    })
  }
}
