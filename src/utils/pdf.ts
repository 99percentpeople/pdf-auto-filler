import {
  asPDFName,
  degrees,
  drawImage,
  drawText,
  PDFContentStream,
  PDFFont,
  PDFImage,
  PDFOperator,
  PDFOperatorNames,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  rotateDegrees,
  translate,
} from "pdf-lib";

function signatureAppearanceStream(
  image: PDFImage,
  text: string,
  rotation: number,
  width: number,
  height: number,
  font: PDFFont,
  size: number,
) {
  const dict = image.doc.context.obj({
    Type: "XObject",
    Subtype: "Form",
    FormType: 1,
    BBox: [0, 0, width, height],
    Resources: {
      XObject: { Image: image.ref },
      Font: { F0: font.ref },
    },
  });
  var operators = [
    rotateDegrees(rotation),
    translate(0, rotation % 90 === 0 ? -width : 0),
    ...drawImage("Image", {
      x: 0,
      y: width, //y = 0 is width for me
      width: width,
      height: height,
      rotate: degrees(0),
      xSkew: degrees(0),
      ySkew: degrees(0),
    }),
    PDFOperator.of(PDFOperatorNames.BeginMarkedContent, [
      asPDFName("Tx"),
    ]),
    pushGraphicsState(),
    ...drawText(font.encodeText(text), {
      color: rgb(0, 0, 0),
      font: "F0",
      size: size,
      rotate: degrees(0),
      xSkew: degrees(0),
      ySkew: degrees(0),
      x: 0,
      y: width, //y = 0 is width for me
    }),
    popGraphicsState(),
    PDFOperator.of(PDFOperatorNames.EndMarkedContent),
  ];
  const stream = PDFContentStream.of(
    dict,
    operators,
    false,
  );
  return image.doc.context.register(stream);
}
