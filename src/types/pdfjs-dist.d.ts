declare module 'pdfjs-dist/legacy/build/pdf' {
  export * from 'pdfjs-dist';
}

declare module 'pdfjs-dist/legacy/build/pdf.worker.min.js' {
  const workerSrc: string;
  export default workerSrc;
}
